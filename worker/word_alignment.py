"""Word events are emitted by the synthesizer for the actual continuous PCM audio.
No equal-duration word interpolation or guessed sentence timings.
"""
import ctypes
import ctypes.util
import re
import shutil
import wave
from pathlib import Path


class EventID(ctypes.Union):
    _fields_ = [("number", ctypes.c_int), ("name", ctypes.c_char_p), ("string", ctypes.c_char * 8)]


class Event(ctypes.Structure):
    _fields_ = [("type", ctypes.c_int), ("unique_identifier", ctypes.c_uint),
                ("text_position", ctypes.c_int), ("length", ctypes.c_int),
                ("audio_position", ctypes.c_int), ("sample", ctypes.c_int),
                ("user_data", ctypes.c_void_p), ("id", EventID)]


def synthesize_words(text, wav_path, language, persona, speed):
    executable = shutil.which("espeak-ng")
    if not executable:
        raise RuntimeError("Economy TTS unavailable: install espeak-ng")
    sibling = Path(executable).resolve().parent.parent / "lib" / "libespeak-ng.so.1"
    name = str(sibling) if sibling.is_file() else ctypes.util.find_library("espeak-ng")
    if not name:
        raise RuntimeError("Word-aligned Economy TTS requires libespeak-ng")
    lib = ctypes.CDLL(name)
    lib.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
    rate = lib.espeak_Initialize(2, 0, None, 0)  # AUDIO_OUTPUT_SYNCHRONOUS
    if rate <= 0:
        raise RuntimeError("TTS initialization failed")
    samples, markers = [], []
    callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.POINTER(Event))

    @callback_type
    def collect(pcm, count, events):
        if pcm and count:
            samples.append(ctypes.string_at(pcm, count * 2))
        index = 0
        while events and events[index].type:
            event = events[index]
            if event.type == 1 and event.length > 0:
                start = event.text_position - 1
                word = text[start:start + event.length]
                if word.strip():
                    markers.append({"text": word, "start": event.audio_position / 1000, "offset": start})
            index += 1
        return 0

    lib.espeak_SetSynthCallback.argtypes = [callback_type]
    lib.espeak_SetSynthCallback(collect)
    lib.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
    voice = (language + ("+f3" if persona == "female" else "+m3")).encode()
    if lib.espeak_SetVoiceByName(voice) != 0:
        raise RuntimeError("TTS voice unavailable")
    lib.espeak_SetParameter(1, speed, 0)
    encoded = text.encode("utf-8") + b"\0"
    lib.espeak_Synth.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]
    result = lib.espeak_Synth(encoded, len(encoded), 0, 1, 0, 1, None, None)
    lib.espeak_Synchronize()
    if result != 0 or not samples or not markers:
        raise RuntimeError("TTS word alignment failed")
    audio = b"".join(samples)
    duration = len(audio) / (rate * 2)
    # Duplicate events occur for pronunciation expansions; keep one timestamp per source token.
    unique = {m["offset"]: m for m in reversed(markers)}
    words = sorted(unique.values(), key=lambda m: m["start"])
    for index, word in enumerate(words):
        word["end"] = words[index + 1]["start"] if index + 1 < len(words) else duration
    if any(w["end"] <= w["start"] for w in words):
        raise RuntimeError("Non-monotonic word alignment")
    with wave.open(str(wav_path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(audio)
    return words, duration


def ass_time(seconds):
    centiseconds = round(seconds * 100)
    hours, rem = divmod(centiseconds, 360000)
    minutes, rem = divmod(rem, 6000)
    seconds, cs = divmod(rem, 100)
    return f"{hours}:{minutes:02}:{seconds:02}.{cs:02}"


def kinetic_ass(words, width=1080, height=1920):
    from PIL import ImageFont
    font_size = round(height * 0.030)
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
    max_width = round(width * 0.74)
    groups, current, line, line_count = [], [], "", 1
    for word in words:
        token = re.sub(r"[{}\\\r\n]", "", word["text"])
        word = {**word, "display": token, "break": False}
        trial = (line + " " + token).strip()
        if font.getlength(trial) > max_width:
            if line_count == 2:
                groups.append(current)
                current, line, line_count = [], "", 1
            else:
                word["break"], line, line_count = True, "", 2
        current.append(word)
        line = (line + " " + token).strip()
        if len(current) >= 7:
            groups.append(current)
            current, line, line_count = [], "", 1
    if current:
        groups.append(current)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,{font_size},&H00FFFFFF,&H0000FFFF,&H00202020,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,{round(width*.10)},{round(width*.16)},{round(height*.20)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for group in groups:
        for active, word in enumerate(group):
            parts = []
            for index, other in enumerate(group):
                separator = "\\N" if other["break"] else " " if index else ""
                color = "&H0000FFFF&" if index == active else "&H00FFFFFF&"
                parts.append(separator + "{\\c" + color + "}" + other["display"])
            lines.append(f"Dialogue: 0,{ass_time(word['start'])},{ass_time(word['end'])},Default,,0,0,0,," + "".join(parts))
    return header + "\n".join(lines) + "\n"