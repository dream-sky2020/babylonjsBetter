import copy
import json
from pathlib import Path
import unittest
from weapon_presets import validate_weapon_presets


class DualWeaponSchemaTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).resolve().parent.parent / 'config' / 'firstPersonWeaponPresets.json'
        self.library = json.loads(path.read_text(encoding='utf-8'))

    def test_mixed_versions_and_disabled_track_roundtrip(self):
        self.assertEqual(validate_weapon_presets(self.library), [])
        p = self.library['dual-alternating-slash']
        p['weapons']['left']['enabled'] = False
        p['weapons']['left']['asset']['scale'] = .5
        p['weapons']['right']['asset']['scale'] = 2
        loaded = json.loads(json.dumps(self.library))
        self.assertEqual(loaded, self.library)
        self.assertEqual(validate_weapon_presets(loaded), [])

    def test_invalid_v2_track_rejected(self):
        p = self.library['dual-alternating-slash']
        cases = []
        bad = copy.deepcopy(p); del bad['weapons']['left']; cases.append(bad)
        bad = copy.deepcopy(p); bad['weapons']['third'] = copy.deepcopy(bad['weapons']['right']); cases.append(bad)
        bad = copy.deepcopy(p)
        for hand in ('right', 'left'):
            bad['weapons'][hand]['enabled'] = False
        cases.append(bad)
        bad = copy.deepcopy(p); bad['weapons']['left']['asset']['assetProfile'] = {}; cases.append(bad)
        bad = copy.deepcopy(p); bad['weapons']['left']['keyframes'][0]['time'] = 10; cases.append(bad)
        bad = copy.deepcopy(p); bad['weapons']['left']['asset']['scale'] = float('nan'); cases.append(bad)
        for bad in cases:
            self.assertTrue(validate_weapon_presets({'test': bad}))

    def test_v3_semantic_volumes_validate_and_reject_invalid_size(self):
        project = copy.deepcopy(self.library['dual-alternating-slash'])
        project['version'] = 3
        for hand, track in project['weapons'].items():
            legacy = track['proxy']
            track['proxy'] = {
                'shape': legacy['shape'], 'size': legacy['size'], 'center': legacy['center'],
                'gripVolume': {'enabled': True, 'shape': 'cylinder', 'center': legacy['grip'], 'size': {'x': .12, 'y': .12, 'z': .28}, 'rotation': {'x': 0, 'y': 0, 'z': 0}},
                'attackVolume': {'enabled': True, 'shape': 'box', 'center': legacy['center'], 'size': {'x': .15, 'y': .1, 'z': 1.1}, 'rotation': {'x': 0, 'y': 0, 'z': 0}},
                'muzzle': {'enabled': False, 'position': legacy['tip'], 'rotation': {'x': 0, 'y': 0, 'z': 0}},
            }
            if hand == 'right':
                track['proxy']['rotation'] = {'x': 12, 'y': -24, 'z': 5}
            else:
                track['proxy']['attackVolume']['shape'] = 'sphere'
        self.assertEqual(validate_weapon_presets({'semantic': project}), [])
        project['weapons']['right']['proxy']['attackVolume']['size']['z'] = 0
        self.assertTrue(validate_weapon_presets({'semantic': project}))


if __name__ == '__main__':
    unittest.main()
