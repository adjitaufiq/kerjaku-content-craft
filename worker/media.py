"""Native economy voice + measured subtitle segments + FFmpeg MP4 composition.
Run only in the external worker, never in the edge application runtime.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import wave


def command(args, timeout=600):
    result = subprocess.run(args, check=True, capture_output=True, timeout=timeout)
    return result.stdout


def probe(path):
    result = json.loads(command(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))
    return result


def timestamp(seconds, separator=","):
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    seconds, ms = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}{separator}{ms:03}"


def voice_segments(text):
    # Each phrase is synthesized and measured separately. No guessed timings.
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    result = []
    for sentence in sentences:
        words = sentence.split()
        for start in range(0, len(words), 9):
            result.append(" ".join(words[start:start + 9]))
    if not result:
        raise ValueError("Voice-over script is empty")
    return result


def synthesize(text, output, language="id", persona="male", speed=165):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    executable = shutil.which("espeak-ng")
    if not executable:
        raise RuntimeError("Economy TTS unavailable: install espeak-ng in the external worker")
    if language not in ("id", "en") or persona not in ("male", "female") or not 80 <= speed <= 260:
        raise ValueError("Unsupported voice settings")
    voice = language + ("+f3" if persona == "female" else "+m3")
    timings = []
    cursor = 0.0
    audio_frames = []
    params = None
    for index, phrase in enumerate(voice_segments(text)):
        path = output / f"segment-{index}.wav"
        subprocess.run([executable, "-v", voice, "-s", str(speed), "-w", str(path), "--stdin"], input=phrase.encode(), check=True, capture_output=True, timeout=120)
        with wave.open(str(path), "rb") as wav:
            params = wav.getparams()
            duration = wav.getnframes() / wav.getframerate()
            audio_frames.append(wav.readframes(wav.getnframes()))
        timings.append({"text": phrase, "start": cursor, "end": cursor + duration})
        cursor += duration
        path.unlink()
    if params is None:
        raise RuntimeError("TTS returned no audio")
    combined = output / "combined.wav"
    with wave.open(str(combined), "wb") as wav:
        wav.setparams(params)
        wav.writeframes(b"".join(audio_frames))
    mp3 = output / "voice.mp3"
    command(["ffmpeg", "-y", "-v", "error", "-i", str(combined), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3)])
    combined.unlink()
    srt = "\n\n".join(f"{i + 1}\n{timestamp(t['start'])} --> {timestamp(t['end'])}\n{t['text']}" for i, t in enumerate(timings)) + "\n"
    vtt = "WEBVTT\n\n" + "\n\n".join(f"{timestamp(t['start'], '.')} --> {timestamp(t['end'], '.')}\n{t['text']}" for t in timings) + "\n"
    (output / "subtitles.srt").write_text(srt, encoding="utf-8")
    (output / "subtitles.vtt").write_text(vtt, encoding="utf-8")
    (output / "alignment.json").write_text(json.dumps({"method": "measured_phrase_audio", "duration": cursor, "segments": timings}, ensure_ascii=False), encoding="utf-8")
    return {"duration": float(probe(mp3)["format"]["duration"]), "segments": timings}


def compose(images, voice, subtitles, output, width=1080, height=1920, bgm=None):
    output = Path(output)
    if not images or not Path(voice).is_file() or not Path(subtitles).is_file():
        raise ValueError("Images, voice-over and synchronized subtitles are required")
    duration = float(probe(voice)["format"]["duration"])
    if duration <= 0:
        raise ValueError("Invalid voice-over duration")
    slide_duration = duration / len(images)
    args = ["ffmpeg", "-y", "-v", "error"]
    for image in images:
        args += ["-loop", "1", "-t", str(slide_duration), "-i", str(image)]
    args += ["-i", str(voice)]
    if bgm:
        args += ["-stream_loop", "-1", "-i", str(bgm)]
    filters = []
    for index in range(len(images)):
        caption_band = round(height * 0.14)
        filters.append(f"[{index}:v]scale={width}:{height-caption_band}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih-{caption_band})/2,setsar=1,fps=30,trim=duration={slide_duration},setpts=PTS-STARTPTS[v{index}]")
    filters.append("".join(f"[v{i}]" for i in range(len(images))) + f"concat=n={len(images)}:v=1:a=0[slides]")
    # Path supplied by our temporary directory, not user input; escape for the subtitles filter.
    escaped = str(Path(subtitles).resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    filters.append(f"[slides]subtitles='{escaped}':force_style='PlayResX={width},PlayResY={height},FontName=DejaVu Sans,FontSize={round(height*0.025)},Outline=2,MarginV={round(height*0.04)},MarginL={round(width*0.06)},MarginR={round(width*0.06)},Alignment=2'[video]")
    if bgm:
        filters += [f"[{len(images)+1}:a]volume=0.10[bgm]", f"[{len(images)}:a][bgm]amix=inputs=2:duration=first[audio]"]
    args += ["-filter_complex", ";".join(filters), "-map", "[video]", "-map", "[audio]" if bgm else f"{len(images)}:a", "-t", str(duration), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(output)]
    command(args)
    info = probe(output)
    video = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if not video or not audio or video["width"] != width or video["height"] != height:
        raise RuntimeError("Rendered MP4 did not pass media validation")
    if abs(float(info["format"]["duration"]) - duration) > 1:
        raise RuntimeError("Voice/video duration mismatch")
    return info


def metadata(path, kind, mime, storage_path, duration=None):
    path = Path(path)
    return {"kind": kind, "mime": mime, "path": storage_path, "bytes": path.stat().st_size, "checksum": hashlib.sha256(path.read_bytes()).hexdigest(), "duration": duration}