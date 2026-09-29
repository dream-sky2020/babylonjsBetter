import json
import tempfile
import unittest
from pathlib import Path
from scene_environment_presets import read_scene_environment_presets


class SceneCatalogTests(unittest.TestCase):
    def test_real_repository(self):
        root = Path(__file__).resolve().parents[1] / "config" / "sceneEnvironmentPresets"
        data = read_scene_environment_presets(root)
        self.assertEqual(len(data), 5)
        self.assertEqual(data["monster-formation-road-shadow-shape-test"]["extendsPresetKey"], "monster-formation-road")

    def test_invalid_references_and_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def put(name, value):
                (root / name).write_text(json.dumps(value), encoding="utf-8")
            put("index.json", {"version": 1, "presets": {"base": "base.json"}})
            put("base.json", {"presetKey": "base", "extendsPresetKey": "base"})
            with self.assertRaises(ValueError):
                read_scene_environment_presets(root)
            put("base.json", {"presetKey": "wrong"})
            with self.assertRaises(ValueError):
                read_scene_environment_presets(root)
            put("index.json", {"version": 1, "presets": {"base": "../base.json"}})
            with self.assertRaises(ValueError):
                read_scene_environment_presets(root)


if __name__ == "__main__":
    unittest.main()
