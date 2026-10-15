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

    def test_new_three_node_preset_save_read(self):
        self.round_trip(self.preset)

    def test_incomplete_rules_and_dangling_connections_save_as_drafts(self):
        self.preset['graph']['nodes']['gate_check']['condition'] = {'type': 'all', 'conditions': []}
        self.preset['graph']['nodes']['open_gate']['events'][0].update({'eventType': '', 'version': 0})
        edge = copy.deepcopy(next(iter(self.preset['graph']['edges'].values())))
        edge['id'] = 'dangling'; edge['from'] = {'nodeId': 'absent', 'portId': 'missing'}
        edge['to'] = {'nodeId': 'absent2', 'portId': 'missing2'}
        self.preset['graph']['edges']['dangling'] = edge
        self.round_trip(self.preset)

    def test_outputs_allow_one_connection_and_inputs_allow_multiple(self):
        edge = copy.deepcopy(next(iter(self.preset['graph']['edges'].values())))
        edge['id'] = 'shared-input'
        edge['from'] = {'nodeId': 'another', 'portId': 'port:another:output:next'}
        self.preset['graph']['edges'][edge['id']] = edge
        self.assertFalse(server._validate_dialogue_map_library({'village_gate': self.preset}))
        edge = copy.deepcopy(next(iter(self.preset['graph']['edges'].values())))
        edge['id'] = 'duplicate-output'
        edge['to'] = {'nodeId': 'another', 'portId': 'port:another:in'}
        self.preset['graph']['edges'][edge['id']] = edge
        errors = server._validate_dialogue_map_library({'village_gate': self.preset})
        self.assertTrue(any('output port may have only one connection' in error for error in errors))

    def test_old_versions_and_malformed_shapes_are_rejected(self):
        for version in (1, 2, 3, 4):
            preset = copy.deepcopy(self.preset); preset['schemaVersion'] = version
            self.assertTrue(server._validate_dialogue_map_library({'village_gate': preset}))
        for condition in ({'type': 'legacy', 'expression': 'allowed'}, {'type': 'all', 'conditions': 42}):
            preset = copy.deepcopy(self.preset); preset['graph']['nodes']['gate_check']['condition'] = condition
            self.assertTrue(server._validate_dialogue_map_library({'village_gate': preset}))

    def test_cards_require_exactly_one_input(self):
        for kind in ('choice', 'condition', 'event'):
            original = next(node for node in self.preset['graph']['nodes'].values() if node['kind'] == kind)
            for count in (0, 2):
                preset = copy.deepcopy(self.preset)
                node = preset['graph']['nodes'][original['id']]
                node['inputs'] = {f'input:{index}': {'id': f'input:{index}'} for index in range(count)}
                node['inputOrder'] = list(node['inputs'])
                self.assertTrue(any('exactly one input' in error for error in server._validate_dialogue_map_library({'village_gate': preset})))

    def test_nested_conditions_and_negation_are_rejected(self):
        comparison = self.preset['graph']['nodes']['gate_check']['condition']['conditions'][0]
        for condition in ({'type': 'all', 'conditions': [{'type': 'any', 'conditions': [comparison]}]}, {'type': 'not', 'condition': comparison}):
            preset = copy.deepcopy(self.preset)
            preset['graph']['nodes']['gate_check']['condition'] = condition
            self.assertTrue(server._validate_dialogue_map_library({'village_gate': preset}))

    def test_send_event_lists_and_wait_cardinality(self):
        node = self.preset['graph']['nodes']['open_gate']
        node['events'].append(copy.deepcopy(node['events'][0]))
        self.round_trip(self.preset)
        node['mode'] = 'wait'
        self.assertTrue(server._validate_dialogue_map_library({'village_gate': self.preset}))
        node['events'] = [node['events'][0]]
        self.assertFalse(server._validate_dialogue_map_library({'village_gate': self.preset}))
        node['events'] = []
        self.assertTrue(server._validate_dialogue_map_library({'village_gate': self.preset}))

    def test_node_whitespace_save_read_and_validation(self):
        display = self.preset['graph']['nodes']['open_gate']['display']
        display['whitespace'] = dict(header=True, content=False, outputs=False, top=False, sections=False, bottom=False, height=False)
        self.round_trip(self.preset)
        for invalid in (None, [], True, {'header': 'true'}, {'unknown': True}):
            display['whitespace'] = invalid
            errors = server._validate_dialogue_map_library({'village_gate': self.preset})
            self.assertTrue(any('whitespace' in error for error in errors))

    def test_empty_graph_remains_a_saveable_draft(self):
        self.preset['graph'] = {'nodes': {}, 'edges': {}}; self.round_trip(self.preset)

    def test_self_connection_is_rejected_at_save_boundary(self):
        edge = next(iter(self.preset['graph']['edges'].values()))
        source = edge['from']['nodeId']
        edge['to'] = {'nodeId': source, 'portId': f'port:{source}:in'}
        self.assertTrue(any('own input' in error for error in server._validate_dialogue_map_library({'village_gate': self.preset})))


if __name__ == '__main__':
    unittest.main()
