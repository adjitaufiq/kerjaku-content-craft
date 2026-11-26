"""Continuous neural speech with actual provider word-boundary events; no guessed timing."""
import asyncio
import html
import json
import re
from pathlib import Path
import edge_tts


async def _stream(text, output, language, persona, speed, selected_voice=None):
    voices = {("id", "male"): "id-ID-ArdiNeural", ("id", "female"): "id-ID-GadisNeural",
              ("en", "male"): "en-US-GuyNeural", ("en", "female"): "en-US-JennyNeural"}
    voice = selected_voice or voices[(language, persona)]
    if voice not in voices.values():
        raise ValueError("Unsupported neural voice")
    rate = round((speed / 165 - 1) * 100)
    stream = edge_tts.Communicate(text, voice, rate=f"{rate:+d}%", boundary="WordBoundary", receive_timeout=90)
    words, cursor = [], 0
    with open(output, "wb") as audio:
        async for chunk in stream.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                token = html.unescape(chunk["text"])
                match = re.search(re.escape(token), text[cursor:], re.IGNORECASE)
                if not match:
                    raise RuntimeError("Provider word cannot be mapped to narration; hold subtitles")
                offset = cursor + match.start()
                cursor = offset + len(token)
                start = chunk["offset"] / 10_000_000
                end = start + chunk["duration"] / 10_000_000
                words.append({"text": text[offset:cursor], "offset": offset, "start": start, "end": end})
    if not words or not Path(output).stat().st_size or any(w["end"] <= w["start"] for w in words):
        raise RuntimeError("Neural voice unavailable or missing word boundaries; no robotic fallback")
    if re.search(r"\w", text[cursor:]):
        raise RuntimeError("Neural speech incomplete")
    return words, voice


def synthesize_neural(text, output, language, persona, speed, voice=None):
    return asyncio.run(_stream(text, output, language, persona, speed, voice))
