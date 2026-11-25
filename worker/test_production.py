import json
import tempfile
import unittest
from pathlib import Path
from design import carousel_plan
from runner import validate_native_file


class ProductionContractsTests(unittest.TestCase):
    def content(self):
        scenes = [{"heading": "Hook", "narration": "Mulai dari satu proses."},
                  {"heading": "Langkah", "narration": "petakan pilih uji catat tinjau perbaiki bandingkan dokumentasikan ukur evaluasi"},
                  {"heading": "CTA", "narration": "Diskusikan dengan KERJAKU."}]
        return {"title": "AI Automation", "production": {"hook": "Mulai", "cta": "Diskusi", "scenes": json.dumps(scenes)}}

    def test_five_slide_carousel_preserves_material_once(self):
        plan = carousel_plan(self.content(), 5)
        self.assertEqual(len(plan), 5)
        self.assertEqual(" ".join(body for _, body in plan[1:-1]), "petakan pilih uji catat tinjau perbaiki bandingkan dokumentasikan ukur evaluasi")

    def test_seven_slide_carousel_preserves_material_once(self):
        plan = carousel_plan(self.content(), 7)
        self.assertEqual(len(plan), 7)
        self.assertEqual(len(set(body for _, body in plan[1:-1])), 5)

    def test_ten_slide_carousel_preserves_material_once(self):
        plan = carousel_plan(self.content(), 10)
        self.assertEqual(len(plan), 10)
        self.assertEqual(len(set(body for _, body in plan[1:-1])), 8)

    def test_insufficient_material_is_held_not_duplicated(self):
        content = self.content()
        scenes = json.loads(content["production"]["scenes"])
        scenes[1]["narration"] = "uji"
        content["production"]["scenes"] = json.dumps(scenes)
        with self.assertRaisesRegex(ValueError, "insufficient"):
            carousel_plan(content, 5)

    def test_missing_native_output_cannot_enter_library(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "missing"):
                validate_native_file(Path(folder, "video.mp4"), {"kind": "video"}, self.content())


if __name__ == "__main__":
    unittest.main()