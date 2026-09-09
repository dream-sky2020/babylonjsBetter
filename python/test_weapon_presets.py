import copy
import json
import os
import tempfile
import unittest
import server


class WeaponPresetApiTests(unittest.TestCase):
    def test_roundtrip_and_rejected_write_preserves_file(self):
        with open(server.FIRST_PERSON_WEAPON_PRESET_CONFIG_PATH, encoding='utf-8') as source:
            library = json.load(source)
        original = server.FIRST_PERSON_WEAPON_PRESET_CONFIG_PATH
        shake_original = server.MODEL_SHAKE_PRESET_CONFIG_PATH
        with open(shake_original, 'rb') as source:
            shake_bytes = source.read()
        try:
            with tempfile.TemporaryDirectory() as directory:
                server.FIRST_PERSON_WEAPON_PRESET_CONFIG_PATH = os.path.join(directory, 'weapons.json')
                client = server.app.test_client()
                self.assertEqual(client.get('/api/first-person-weapon-presets').json['data'], {})
                preset = library['right-hand-slash']
                preset['asset']['path'] = '/resources/Model/GLB/espada.glb'
                preset['asset']['offset']['x'] = .3
                preset['asset']['rotation']['y'] = 90
                preset['asset']['scale'] = .7
                self.assertEqual(client.put('/api/first-person-weapon-presets', json=library).status_code, 200)
                self.assertEqual(client.get('/api/first-person-weapon-presets').json['data'], library)
                for field, value in [('scale', 0), ('path', 'local:a.glb'), ('assetProfile', {})]:
                    bad = copy.deepcopy(library)
                    bad['right-hand-slash']['asset'][field] = value
                    self.assertEqual(client.put('/api/first-person-weapon-presets', json=bad).status_code, 400)
                    self.assertEqual(client.get('/api/first-person-weapon-presets').json['data'], library)
                self.assertEqual(client.put('/api/first-person-weapon-presets', json=[]).status_code, 400)
                bad = copy.deepcopy(library)
                bad['dual-alternating-slash']['weapons']['left']['keyframes'][0]['time'] = 100
                self.assertEqual(client.put('/api/first-person-weapon-presets', json=bad).status_code, 400)
                self.assertEqual(client.get('/api/first-person-weapon-presets').json['data'], library)
                with open(shake_original, 'rb') as source:
                    self.assertEqual(source.read(), shake_bytes)
        finally:
            server.FIRST_PERSON_WEAPON_PRESET_CONFIG_PATH = original


if __name__ == '__main__':
    unittest.main()
