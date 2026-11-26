"""Shared native production stages used by both the durable consumer and local command."""
import json
import shutil
from pathlib import Path
from design import design_bundle, scene_list
from media import synthesize, compose, probe, metadata


def original_bgm(output, duration, style="lofi"):
    """Select an original instrumental asset. Missing music blocks, never synthesize a tone."""
    from music_assets import instrumental_path
    source = instrumental_path(style)
    from media import command
    command(["ffmpeg", "-y", "-v", "error", "-stream_loop", "-1", "-i", str(source), "-t", str(duration), "-af", "afade=t=in:d=0.5,afade=t=out:st=" + str(max(0, duration - .8)) + ":d=0.8", str(output)])


def render_storyboard(content, images, voice, ass, alignment, output, bgm=None):
    words = json.loads(Path(alignment).read_text())["words"]
    duration = float(probe(voice)["format"]["duration"])
    scenes = scene_list(content)
    expected = " ".join(scene["narration"].strip() for scene in scenes)
    if content["production"]["voiceOver"].strip() != expected:
        raise ValueError("Storyboard narration differs from voice-over; do not render misaligned scenes")
    boundaries, consumed = [0.0], 0
    # Text offsets emitted by the synthesizer align scene changes to their actual first spoken word.
    for scene in scenes[:-1]:
        consumed += len(scene["narration"].strip()) + 1
        next_word = next((w for w in words if w["offset"] >= consumed), None)
        if next_word:
            boundaries.append(next_word["start"])
    boundaries.append(duration)
    boundaries = sorted(set(boundaries))
    durations = [b - a for a, b in zip(boundaries, boundaries[1:]) if b - a > .02]
    if len(images) != len(scenes) or len(durations) != len(scenes):
        raise ValueError("Every scene requires its own visual and measured narration boundary")
    return compose(images, voice, ass, output, bgm=bgm, scene_durations=durations, motions=[s.get("camera_motion", "slow push in") for s in scenes])


def run_production(content, images, folder, formats, slides=7, voice_settings=None):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    files = design_bundle(content, images, folder, formats, slides)
    if "Video" in formats:
        settings = voice_settings or {}
        audio = synthesize(content["production"]["voiceOver"], folder, persona=settings.get("persona", "female"), speed=settings.get("speed", 165), voice=content["production"].get("automation", {}).get("voice"))
        original_bgm(folder / "bgm.wav", audio["duration"], content["production"].get("automation", {}).get("bgm", "lofi"))
        render_storyboard(content, images, folder / "voice.mp3", folder / "subtitles.ass", folder / "alignment.json", folder / "video.mp4", folder / "bgm.wav")
        files += [folder / name for name in ("voice.mp3", "subtitles.srt", "subtitles.vtt", "subtitles.ass", "alignment.json", "video.mp4", "bgm.wav")]
    assets = []
    for file in files:
        suffix = file.suffix
        kind = "image" if suffix in (".png", ".jpg") else "voice" if suffix == ".mp3" else "video" if suffix == ".mp4" else "subtitle" if suffix in (".ass", ".srt", ".vtt") else "metadata"
        mime = {".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".srt": "application/x-subrip", ".ass": "text/x-ssa", ".vtt": "text/vtt", ".wav": "audio/wav", ".json": "application/json"}[suffix]
        duration = float(probe(file)["format"]["duration"]) if kind in ("voice", "video") else None
        assets.append({**metadata(file, kind, mime, str(file), duration), "bucket": "local-filesystem"})
    return assets


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("packet")
    args = parser.parse_args()
    packet = json.loads(Path(args.packet).read_text())
    assets = run_production(packet["content"], packet["images"], packet["output"], packet["config"]["formats"], packet["config"]["slides"], packet["config"]["voice"])
    Path(packet["output"], "native-assets.json").write_text(json.dumps(assets, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()