import copy
import json
import os
import tempfile
import unittest

import server
from animation_scene_presets import validate_animation_scene_presets


class AnimationScenePresetApiTests(unittest.TestCase):
    def test_schema_and_api_roundtrip(self):
        with open(server.ANIMATION_SCENE_PRESET_CONFIG_PATH, encoding="utf-8") as source:
            library = json.load(source)
        self.assertEqual(validate_animation_scene_presets(library), [])
        original = server.ANIMATION_SCENE_PRESET_CONFIG_PATH
        try:
            with tempfile.TemporaryDirectory() as directory:
                server.ANIMATION_SCENE_PRESET_CONFIG_PATH = os.path.join(directory, "animations.json")
                client = server.app.test_client()
                self.assertEqual(client.get("/api/animation-scene-presets").json["data"], {})
                self.assertEqual(client.put("/api/animation-scene-presets", json=library).status_code, 200)
                self.assertEqual(client.get("/api/animation-scene-presets").json["data"], library)

                bad = copy.deepcopy(library)
                first = next(iter(bad.values()))
                first["bindings"][0]["outputId"] = "missing-output"
                self.assertEqual(client.put("/api/animation-scene-presets", json=bad).status_code, 400)
                self.assertEqual(client.get("/api/animation-scene-presets").json["data"], library)
                self.assertEqual(client.put("/api/animation-scene-presets", json=[]).status_code, 400)
        finally:
            server.ANIMATION_SCENE_PRESET_CONFIG_PATH = original


if __name__ == "__main__":
    unittest.main()
