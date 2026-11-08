import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import server
from utils import validate_dungeon_map_preset_payload

class DungeonInteractionTests(unittest.TestCase):
    def test_directional_rules_roundtrip_and_invalid_types_fail(self):
        source = json.loads((Path(__file__).resolve().parents[1] / 'config/dungeonMapPresets/dungeon_direction_test.json').read_text(encoding='utf-8'))
        self.assertEqual(validate_dungeon_map_preset_payload({'dungeon_direction_test': source}), [])
        for change in [{'worldSides': ['up']}, {'localSides': ['front', 'front']}, {'localSides': [None]}, {'directionSpace': 'camera'}, {'onceScope': 'permanent'}, {'ruleName': 123}]:
            bad = copy.deepcopy(source); bad['components']['event'][0].update(change)
            self.assertTrue(validate_dungeon_map_preset_payload({'dungeon_direction_test': bad}), change)
        source['components']['grid-facing'] = [{'id': 'compass:facing', 'entityId': 'compass', 'type': 'grid-facing', 'version': 1, 'facing': 'east'}]
        self.assertEqual(validate_dungeon_map_preset_payload({'dungeon_direction_test': source}), [])
        for value in [None, {}, [None], [dict(source['components']['grid-facing'][0], facing='up')]]:
            bad = copy.deepcopy(source); bad['components']['grid-facing'] = value
            self.assertTrue(validate_dungeon_map_preset_payload({'dungeon_direction_test': bad}))

    def source(self):
        return json.loads((Path(__file__).resolve().parents[1] / 'config/dungeonMapPresets/dungeon_interaction_test.json').read_text(encoding='utf-8'))

    def test_typed_events_save_and_reload_without_changing_actor_or_target(self):
        source = self.source()
        self.assertEqual(validate_dungeon_map_preset_payload({'dungeon_interaction_test': source}), [])
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server, 'DUNGEON_MAP_PRESET_CONFIG_DIR', directory), patch.object(server, 'DUNGEON_MAP_PRESET_INDEX_PATH', str(Path(directory) / 'index.json')):
                client = server.app.test_client()
                saved = client.put('/api/dungeon-map-presets', json={'dungeon_interaction_test': source})
                self.assertEqual(saved.status_code, 200, saved.get_json())
                loaded = client.get('/api/dungeon-map-presets/dungeon_interaction_test')
                self.assertEqual(loaded.status_code, 200)
                self.assertEqual(loaded.json['data'], source)
                bad = copy.deepcopy(source)
                bad['components']['event'][0]['action']['presetKey'] = []
                self.assertEqual(client.put('/api/dungeon-map-presets', json={'dungeon_interaction_test': bad}).status_code, 400)
                self.assertEqual(client.get('/api/dungeon-map-presets/dungeon_interaction_test').json['data'], source)

    def test_authoring_drafts_and_legacy_are_retained_but_malformed_types_rejected(self):
        source = self.source()
        source['components']['event'][0]['action'] = {'type': 'dialogue', 'presetKey': '', 'entryNodeId': ''}
        self.assertEqual(validate_dungeon_map_preset_payload({'dungeon_interaction_test': source}), [])
        for patch_data in [{'priority': True}, {'priority': None}, {'priority': 1.5}, {'version': True}, {'trigger': 'unknown'}, {'action': []}, {'targetRule': 'far-away'}]:
            bad = copy.deepcopy(source); bad['components']['event'][0].update(patch_data)
            self.assertTrue(validate_dungeon_map_preset_payload({'dungeon_interaction_test': bad}))
        source['components']['event'][0] = {'id': 'legacy', 'entityId': 'guide', 'type': 'event', 'version': 1, 'trigger': 'custom', 'actionId': 'old-action', 'payload': {'retain': True}}
        self.assertEqual(validate_dungeon_map_preset_payload({'dungeon_interaction_test': source}), [])

if __name__ == '__main__':
    unittest.main()
