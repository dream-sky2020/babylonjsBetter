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


if __name__ == '__main__':
    unittest.main()
