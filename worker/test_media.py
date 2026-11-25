import json
import os
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from media import synthesize, compose, probe, timestamp, voice_segments


class NativeProductionTests(unittest.TestCase):
    def test_timestamp_and_nonempty_segments(self):
        self.assertEqual(timestamp(61.234), "00:01:01,234")
        self.assertEqual(voice_segments("AI membantu bisnis. Manusia tetap memutuskan."), ["AI membantu bisnis.", "Manusia tetap memutuskan."])

    def test_actual_indonesian_mp3_and_synchronized_mp4(self):
        with tempfile.TemporaryDirectory(prefix="craft-test-") as temp:
            folder = Path(temp)
            voice = synthesize("AI membantu pekerjaan berulang. Pemilik bisnis tetap memutuskan. Mulai dari satu proses sederhana bersama KERJAKU.", folder)
            self.assertGreater((folder / "voice.mp3").stat().st_size, 1000)
            self.assertEqual(probe(folder / "voice.mp3")["streams"][0]["codec_name"], "mp3")
            self.assertLess(abs(voice["duration"] - voice["segments"][-1]["end"]), 0.1)
            supplied = os.environ.get("CRAFT_TEST_IMAGE")
            if supplied:
                image = Path(supplied)
            else:
                image = folder / "test-frame.png"
                Image.new("RGB", (1080, 1920), "#19414b").save(image)
            result = compose([image], folder / "voice.mp3", folder / "subtitles.srt", folder / "video.mp4", width=1080, height=1920)
            streams = {s["codec_type"]: s for s in result["streams"]}
            self.assertEqual(streams["video"]["codec_name"], "h264")
            self.assertEqual(streams["audio"]["codec_name"], "aac")
            self.assertEqual((streams["video"]["width"], streams["video"]["height"]), (1080, 1920))
            self.assertLess(abs(float(result["format"]["duration"]) - voice["duration"]), 1)
            destination = os.environ.get("CRAFT_TEST_OUTPUT")
            if destination:
                import shutil
                Path(destination).mkdir(parents=True, exist_ok=True)
                for name in ("voice.mp3", "video.mp4", "subtitles.srt", "subtitles.vtt", "alignment.json"):
                    shutil.copy(folder / name, Path(destination) / name)
                (Path(destination) / "probe.json").write_text(json.dumps(result, indent=2))

    def test_english_female_voice(self):
        with tempfile.TemporaryDirectory(prefix="craft-voice-") as temp:
            result = synthesize("Automate repetitive work, keep human decisions.", temp, language="en", persona="female", speed=150)
            self.assertGreater(result["duration"], 1)
            self.assertTrue((Path(temp) / "subtitles.vtt").read_text().startswith("WEBVTT"))


if __name__ == "__main__":
    unittest.main()