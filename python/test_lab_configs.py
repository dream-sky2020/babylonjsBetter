import json
import os
import tempfile
import unittest
from flask import Flask
from lab_configs import register_lab_config_routes

class LabConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        app = Flask(__name__)
        register_lab_config_routes(app, lambda: self.temp.name)
        self.client = app.test_client()

    def tearDown(self):
        self.temp.cleanup()

    def document(self, lab_id, speed):
        return dict(format='lab-config', version=1, labId=lab_id, modules={'player-movement': {'speed': speed}})

    def test_roundtrip_isolation_and_conflict(self):
        self.assertEqual(self.client.get('/api/lab-configs/first').status_code, 400)
        a = self.client.put('/api/lab-configs/first', json=dict(data=self.document('first', 6), revision=None))
        b = self.client.put('/api/lab-configs/second', json=dict(data=self.document('second', 9), revision=None))
        self.assertEqual(a.status_code, 200)
        self.assertEqual(b.status_code, 200)
        self.assertEqual(self.client.get('/api/lab-configs/first').json['data']['modules']['player-movement']['speed'], 6)
        self.assertEqual(self.client.get('/api/lab-configs/second').json['data']['modules']['player-movement']['speed'], 9)
        self.assertEqual(self.client.put('/api/lab-configs/first', json=dict(data=self.document('first', 7), revision=None)).status_code, 409)
        saved = self.client.put('/api/lab-configs/first', json=dict(data=self.document('first', 7), revision=a.json['revision']))
        self.assertEqual(saved.status_code, 200)
        with open(os.path.join(self.temp.name, 'first.json'), encoding='utf-8') as source:
            self.assertEqual(json.load(source), self.document('first', 7))
        self.assertEqual(sorted(os.listdir(self.temp.name)), ['first.json', 'second.json'])

    def test_bad_payload_cannot_overwrite_file(self):
        saved = self.client.put('/api/lab-configs/first', json=dict(data=self.document('first', 6), revision=None)).json
        for data in [[], self.document('second', 7), dict(self.document('first', 7), version=2),
                     dict(self.document('first', 7), modules={'__proto__': {}}), self.document('first', float('inf'))]:
            response = self.client.put('/api/lab-configs/first', json=dict(data=data, revision=saved['revision']))
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get('/api/lab-configs/first').json, saved)
        self.assertEqual(self.client.put('/api/lab-configs/first', json=dict(data=self.document('first', 6))).status_code, 400)
        self.assertEqual(self.client.get('/api/lab-configs/bad_name').status_code, 400)

if __name__ == '__main__':
    unittest.main()
