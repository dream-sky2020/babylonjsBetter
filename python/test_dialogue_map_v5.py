import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import server


class DialogueV5Tests(unittest.TestCase):
    def setUp(self):
        self.preset = json.loads((Path(__file__).resolve().parents[1] / 'config/dialogueMapPresets/village_gate.json').read_text(encoding='utf-8'))

    def round_trip(self, preset):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server, 'DIALOGUE_MAP_PRESET_CONFIG_DIR', directory), patch.object(server, 'DIALOGUE_MAP_PRESET_INDEX_PATH', str(Path(directory) / 'index.json')):
                client = server.app.test_client()
                response = client.put('/api/dialogue-map-presets', json={'village_gate': preset})
                self.assertEqual(response.status_code, 200, response.get_json())
                loaded = client.get('/api/dialogue-map-presets/village_gate')
                self.assertEqual(loaded.status_code, 200, loaded.get_json())
                self.assertEqual(loaded.get_json()['data'], preset)

    def test_new_four_node_preset_save_read(self):
        self.round_trip(self.preset)

    def test_incomplete_rules_and_multiple_or_dangling_connections_save_as_drafts(self):
        self.preset['graph']['nodes']['gate_check']['condition'] = {'type': 'all', 'conditions': []}
        self.preset['graph']['nodes']['open_gate']['event'].update({'eventType': '', 'version': 0})
        edge = copy.deepcopy(next(iter(self.preset['graph']['edges'].values())))
        edge['id'] = 'duplicate'; edge['to']['nodeId'] = 'absent'; self.preset['graph']['edges']['duplicate'] = edge
        self.round_trip(self.preset)

    def test_old_versions_and_malformed_shapes_are_rejected(self):
        for version in (1, 2, 3, 4):
            preset = copy.deepcopy(self.preset); preset['schemaVersion'] = version
            self.assertTrue(server._validate_dialogue_map_library({'village_gate': preset}))
        for condition in ({'type': 'legacy', 'expression': 'allowed'}, {'type': 'all', 'conditions': 42}):
            preset = copy.deepcopy(self.preset); preset['graph']['nodes']['gate_check']['condition'] = condition
            self.assertTrue(server._validate_dialogue_map_library({'village_gate': preset}))

    def test_empty_graph_remains_a_saveable_draft(self):
        self.preset['graph'] = {'nodes': {}, 'edges': {}}; self.round_trip(self.preset)


if __name__ == '__main__':
    unittest.main()
