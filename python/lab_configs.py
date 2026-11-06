"""Per-composable-Lab authored configuration; deliberately separate from saves."""
import hashlib
import json
import math
import os
import re
import tempfile
import threading

from flask import jsonify, request

_lock = threading.Lock()
_key = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}\Z")

def validate_document(data, lab_id):
    def valid(value, depth=0):
        if depth > 20:
            return False
        if value is None or isinstance(value, (str, bool)):
            return True
        if isinstance(value, (int, float)):
            return math.isfinite(value)
        if isinstance(value, list):
            return all(valid(item, depth + 1) for item in value)
        return isinstance(value, dict) and all(
            _key.fullmatch(key) and key not in ("__proto__", "prototype", "constructor") and valid(item, depth + 1)
            for key, item in value.items())
    if (not isinstance(data, dict) or data.get("format") != "lab-config"
            or type(data.get("version")) is not int or data["version"] != 1 or data.get("labId") != lab_id
            or not isinstance(data.get("modules"), dict) or not valid(data["modules"])
            or any(not isinstance(values, dict) for values in data["modules"].values())):
        raise ValueError("Lab 配置格式、版本、ID 或参数无效。")

def register_lab_config_routes(app, directory):
    @app.route('/api/lab-configs/<lab_id>', methods=['GET', 'PUT'])
    def lab_config(lab_id):
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,95}', lab_id):
            return jsonify(error='无效的 Lab ID。'), 400
        root = os.path.realpath(directory())
        target = os.path.realpath(os.path.join(root, lab_id + '.json'))
        if os.path.commonpath([root, target]) != root:
            return jsonify(error='配置路径无效。'), 400
        try:
            with _lock:
                previous = None
                if os.path.isfile(target):
                    with open(target, 'rb') as source:
                        previous = source.read()
                revision = hashlib.sha256(previous).hexdigest() if previous is not None else None
                if request.method == 'GET':
                    if previous is None:
                        return jsonify(error='缺少此 Lab 的配置文件。'), 400
                    data = json.loads(previous)
                    validate_document(data, lab_id)
                    return jsonify(data=data, revision=revision)
                if request.content_length and request.content_length > 2 * 1024 * 1024:
                    return jsonify(error='配置文件过大。'), 413
                payload = request.get_json(silent=True)
                if not isinstance(payload, dict) or 'revision' not in payload:
                    return jsonify(error='保存请求缺少版本信息。'), 400
                data = payload.get('data')
                validate_document(data, lab_id)
                if payload['revision'] != revision:
                    return jsonify(error='配置已被其他页面修改，请刷新并核对后保存。'), 409
                encoded = (json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
                os.makedirs(root, exist_ok=True)
                temp_path = None
                try:
                    with tempfile.NamedTemporaryFile(dir=root, delete=False) as temp:
                        temp_path = temp.name
                        temp.write(encoded)
                        temp.flush()
                        os.fsync(temp.fileno())
                    os.replace(temp_path, target)
                finally:
                    if temp_path and os.path.exists(temp_path):
                        os.unlink(temp_path)
                return jsonify(data=data, revision=hashlib.sha256(encoded).hexdigest())
        except (ValueError, UnicodeError) as error:
            return jsonify(error=str(error)), 400
        except OSError:
            return jsonify(error='无法读写 Lab 配置文件，请检查目录权限。'), 500
