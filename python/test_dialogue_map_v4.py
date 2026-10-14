import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import server


class DialogueV4Tests(unittest.TestCase):
    def setUp(self):
        self.preset = json.loads((Path(__file__).resolve().parents[1] / 'config/dialogueMapPresets/village_gate.json').read_text(encoding='utf-8'))
        self.preset['schemaVersion'] = 4
        for node in self.preset['graph']['nodes'].values():
            for output in node['outputs'].values():
                if isinstance(output.get('condition'), str):
                    output['condition'] = {'type': 'legacy', 'expression': output['condition']}
                if 'effects' in output:
                    output['effects'] = [{'type': 'legacy', 'event': item} if isinstance(item, str) else item for item in output['effects']]
        self.output = next(iter(self.preset['graph']['nodes']['greeting']['outputs'].values()))
        self.output['condition'] = {'type': 'compare', 'operator': 'gte',
                                    'left': {'type': 'memory', 'key': 'dungeon.player-state', 'path': ['playerPosition', 'tileX']},
                                    'right': {'type': 'literal', 'value': 5}}
        self.output['effects'] = [{'type': 'event', 'eventType': 'custom.arrived', 'version': 1,
                                  'payload': {'x': {'type': 'memory', 'key': 'dungeon.player-state', 'path': ['playerPosition', 'tileX']}}}]

    def test_v4_save_and_read_round_trip_with_real_endpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server, 'DIALOGUE_MAP_PRESET_CONFIG_DIR', directory), patch.object(server, 'DIALOGUE_MAP_PRESET_INDEX_PATH', str(Path(directory) / 'index.json')):
                client = server.app.test_client()
                response = client.put('/api/dialogue-map-presets', json={'village_gate': self.preset})
                self.assertEqual(response.status_code, 200, response.get_json())
                loaded = client.get('/api/dialogue-map-presets/village_gate')
                self.assertEqual(loaded.status_code, 200, loaded.get_json())
                self.assertEqual(loaded.get_json()['data'], self.preset)

    def test_unfinished_or_invalid_rules_are_rejected(self):
        for change in ({'condition': {'type': 'all', 'conditions': []}},
                       {'condition': {'type': 'compare', 'operator': 'gte', 'left': {'type': 'literal', 'value': True}, 'right': {'type': 'literal', 'value': 5}}},
                       {'effects': [{'type': 'event', 'eventType': '', 'version': 0}]},
                       {'activation': {'type': 'event', 'eventType': 'incoming', 'version': False}},
                       {'effects': [{'type': 'event', 'eventType': 'signal', 'version': 1, 'payload': {'': {'type': 'literal', 'value': 1}}}]}):
            with self.subTest(change=change):
                preset = copy.deepcopy(self.preset)
                next(iter(preset['graph']['nodes']['greeting']['outputs'].values())).update(change)
                self.assertTrue(server._validate_dialogue_map_library({'village_gate': preset}))

    def test_v3_and_explicit_legacy_rules_are_preserved(self):
        self.output['condition'] = {'type': 'legacy', 'expression': 'allowed'}
        self.output['effects'] = [{'type': 'legacy', 'event': 'quest:start'}]
        self.assertEqual(server._validate_dialogue_map_library({'village_gate': self.preset}), [])
        self.preset['schemaVersion'] = 3
        self.output['condition'] = 'allowed'
        self.output['effects'] = ['quest:start']
        self.output['activation'] = {'type': 'event', 'eventId': 'old.signal'}
        self.assertEqual(server._validate_dialogue_map_library({'village_gate': self.preset}), [])


if __name__ == '__main__':
    unittest.main()
