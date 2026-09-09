"""First-person installation presets; never accept asset normalization overrides."""
import math
import re


def _validate_v1_presets(payload):
    def require(ok, field):
        if not ok:
            raise ValueError(f"invalid weapon preset field: {field}")

    def obj(value, keys, field):
        require(isinstance(value, dict) and set(value) == set(keys.split()), field)

    def number(value, field, positive=False):
        require(type(value) in (int, float) and math.isfinite(value) and (not positive or value > 0), field)

    def vector(value, field, positive=False):
        obj(value, "x y z", field)
        for axis in "xyz":
            number(value[axis], field, positive)

    try:
        require(isinstance(payload, dict), "library")
        for key, p in payload.items():
            require(isinstance(key, str) and re.fullmatch(r"[a-zA-Z0-9_-]+", key), "key")
            obj(p, "version name duration loop playbackSpeed proxy asset keyframes", key)
            require(type(p['version']) is int and p['version'] == 1, "version")
            require(isinstance(p['name'], str) and type(p['loop']) is bool, "name / loop")
            number(p['duration'], "duration", True)
            number(p['playbackSpeed'], "playbackSpeed", True)
            proxy = p['proxy']
            obj(proxy, "shape size center grip tip", "proxy")
            require(proxy['shape'] in ('box', 'gun', 'cylinder', 'capsule', 'sphere'), "shape")
            for field in ('size', 'center', 'grip', 'tip'):
                vector(proxy[field], field, field == 'size')
            asset = p['asset']
            obj(asset, "path name scale offset rotation", "asset")
            path = asset['path']
            require(isinstance(path, str), "asset.path")
            require(not path or (re.fullmatch(r"/resources/.+\.(glb|gltf)", path, re.I) and '..' not in path and '\\' not in path), "asset.path")
            require(isinstance(asset['name'], str), "asset.name")
            number(asset['scale'], "asset.scale", True)
            vector(asset['offset'], "asset.offset")
            vector(asset['rotation'], "asset.rotation")
            frames = p['keyframes']
            require(isinstance(frames, list) and len(frames) >= 2, "keyframes")
            ids = set()
            for frame in frames:
                obj(frame, "id time label position rotation", "keyframe")
                require(isinstance(frame['id'], str) and frame['id'] and frame['id'] not in ids, "keyframe.id")
                ids.add(frame['id'])
                number(frame['time'], "keyframe.time")
                require(0 <= frame['time'] <= p['duration'], "keyframe.time")
                require(isinstance(frame['label'], str), "keyframe.label")
                vector(frame['position'], "keyframe.position")
                vector(frame['rotation'], "keyframe.rotation")
        return []
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        return [str(exc)]


def validate_weapon_presets(payload):
    if not isinstance(payload, dict):
        return ['weapon library must be an object']
    for key, project in payload.items():
        if not isinstance(key, str) or not re.fullmatch(r'[a-zA-Z0-9_-]+', key):
            return ['invalid preset key']
        if not isinstance(project, dict):
            return ['invalid project']
        if type(project.get('version')) is int and project['version'] == 1:
            errors = _validate_v1_presets({key: project})
            if errors:
                return errors
            continue
        if type(project.get('version')) is not int or project['version'] != 2 or set(project) != {'version', 'name', 'duration', 'loop', 'playbackSpeed', 'weapons'}:
            return ['invalid v2 project']
        weapons = project['weapons']
        if not isinstance(weapons, dict) or set(weapons) != {'right', 'left'}:
            return ['v2 requires exactly right and left weapon tracks']
        for hand, track in weapons.items():
            if not isinstance(track, dict) or set(track) != {'enabled', 'proxy', 'asset', 'keyframes'} or type(track['enabled']) is not bool:
                return ['invalid weapon track: ' + hand]
            legacy = {field: project[field] for field in ('name', 'duration', 'loop', 'playbackSpeed')}
            legacy.update(version=1, proxy=track['proxy'], asset=track['asset'], keyframes=track['keyframes'])
            errors = _validate_v1_presets({key: legacy})
            if errors:
                return [hand + ': ' + error for error in errors]
        if not any(track['enabled'] for track in weapons.values()):
            return ['at least one weapon track must be enabled']
    return []
