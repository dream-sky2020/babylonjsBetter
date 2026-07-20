# utils.py
import os
import math
import json
from werkzeug.utils import secure_filename

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}
ANCHOR_MIN, ANCHOR_MAX = -1, 2
BOUNDS_MIN, BOUNDS_MAX = 0, 1
COLOR_MIN, COLOR_MAX = 0, 1

def normalize_slashes(path: str) -> str:
    return path.replace("\\", "/")

def to_resource_path(rel_path: str) -> str:
    normalized = normalize_slashes(rel_path).lstrip("/")
    return f"resources/{normalized}"
    
def to_public_path(rel_path: str) -> str:
    return normalize_slashes(rel_path).lstrip("/")

def is_path_inside(base_dir: str, target_path: str) -> bool:
    try:
        return os.path.commonpath([os.path.abspath(base_dir), os.path.abspath(target_path)]) == os.path.abspath(base_dir)
    except ValueError:
        return False

def is_allowed_image_file(path: str) -> bool:
    return os.path.splitext(path.lower())[1] in ALLOWED_IMAGE_EXTENSIONS

def is_finite_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

# --- 核心校验辅助工具 ---
def _req_str(obj: dict, field: str, errs: list, path: str, allow_empty: bool = False) -> str:
    v = obj.get(field)
    if not isinstance(v, str):
        errs.append(f"{path}.{field} 必须是字符串")
        return ""
    if not allow_empty and not v.strip():
        errs.append(f"{path}.{field} 不能为空")
    return v

def _req_num(obj: dict, field: str, errs: list, path: str, c_min=None, c_max=None) -> float:
    v = obj.get(field)
    if not is_finite_number(v):
        errs.append(f"{path}.{field} 必须是有限数字")
        return 0
    num = float(v)
    if c_min is not None and num < c_min: errs.append(f"{path}.{field} 不能小于 {c_min}")
    if c_max is not None and num > c_max: errs.append(f"{path}.{field} 不能大于 {c_max}")
    return num

def _req_obj(obj: dict, field: str, errs: list, path: str) -> dict:
    v = obj.get(field)
    if not isinstance(v, dict):
        errs.append(f"{path}.{field} 必须是对象")
        return {}
    return v

def validate_sprite_anchor_payload(payload: dict) -> list[str]:
    """精简版的嵌套JSON大校验"""
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body 必须是 JSON 对象"]

    for key, preset in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("root 的 key 必须是非空字符串")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{p_path} 必须是对象")
            continue

        p_key = _req_str(preset, "presetKey", errors, p_path)
        img_p = _req_str(preset, "imagePath", errors, p_path)
        
        if preset.get("frameName") is not None and not isinstance(preset.get("frameName"), str):
            errors.append(f"{p_path}.frameName 必须是字符串或 null")
        if p_key and key != p_key:
            errors.append(f"{p_path}.presetKey 必须与对象 key 一致")
        if img_p and not img_p.strip():
            errors.append(f"{p_path}.imagePath 不能为空")

        # 校验边界
        bb = _req_obj(preset, "bodyBounds", errors, p_path)
        min_u = _req_num(bb, "minU", errors, f"{p_path}.bodyBounds", BOUNDS_MIN, BOUNDS_MAX)
        max_u = _req_num(bb, "maxU", errors, f"{p_path}.bodyBounds", BOUNDS_MIN, BOUNDS_MAX)
        min_v = _req_num(bb, "minV", errors, f"{p_path}.bodyBounds", BOUNDS_MIN, BOUNDS_MAX)
        max_v = _req_num(bb, "maxV", errors, f"{p_path}.bodyBounds", BOUNDS_MIN, BOUNDS_MAX)
        if min_u > max_u: errors.append(f"{p_path}.bodyBounds.minU 不能大于 maxU")
        if min_v > max_v: errors.append(f"{p_path}.bodyBounds.minV 不能大于 maxV")

        _req_num(preset, "bodyAxisX", errors, p_path, ANCHOR_MIN, ANCHOR_MAX)

        # 校验锚点
        anchors = _req_obj(preset, "anchors", errors, p_path)
        for name in ("head", "foot", "center"):
            a_obj = anchors.get(name)
            if not isinstance(a_obj, dict):
                errors.append(f"{p_path}.anchors.{name} 必须是对象")
                continue
            _req_num(a_obj, "u", errors, f"{p_path}.anchors.{name}", ANCHOR_MIN, ANCHOR_MAX)
            _req_num(a_obj, "v", errors, f"{p_path}.anchors.{name}", ANCHOR_MIN, ANCHOR_MAX)

        # 校验精灵图册
        af = preset.get("atlasFrame")
        if af is None: continue
        if not isinstance(af, dict):
            errors.append(f"{p_path}.atlasFrame 必须是对象或 null")
            continue

        _req_str(af, "atlasPath", errors, f"{p_path}.atlasFrame")
        _req_str(af, "frameName", errors, f"{p_path}.atlasFrame")
        
        if not isinstance(af.get("rotated"), bool): errors.append(f"{p_path}.atlasFrame.rotated 必须是布尔值")
        if not isinstance(af.get("trimmed"), bool): errors.append(f"{p_path}.atlasFrame.trimmed 必须是布尔值")

        for box_name in ("frame", "spriteSourceSize"):
            box = _req_obj(af, box_name, errors, f"{p_path}.atlasFrame")
            for fld in ("x", "y"): _req_num(box, fld, errors, f_path:=f"{p_path}.atlasFrame.{box_name}", 0)
            for fld in ("w", "h"): _req_num(box, fld, errors, f_path:=f"{p_path}.atlasFrame.{box_name}", 1)

        for size_name in ("sourceSize", "atlasSize"):
            sz = _req_obj(af, size_name, errors, f"{p_path}.atlasFrame")
            for fld in ("w", "h"): _req_num(sz, fld, errors, f"{p_path}.atlasFrame.{size_name}", 1)

    return errors

def validate_particle_preset_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body 必须是 JSON 对象"]

    for key, preset in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("root 的 key 必须是非空字符串")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{p_path} 必须是对象")
            continue

        p_key = _req_str(preset, "presetKey", errors, p_path)
        _req_str(preset, "name", errors, p_path)
        _req_str(preset, "texturePath", errors, p_path)

        if p_key and key != p_key:
            errors.append(f"{p_path}.presetKey 必须与对象 key 一致")

        for bool_field in ("isOneShot", "autoDispose"):
            if not isinstance(preset.get(bool_field), bool):
                errors.append(f"{p_path}.{bool_field} 必须是布尔值")

        _req_num(preset, "capacity", errors, p_path, 1)
        min_life = _req_num(preset, "minLifeTime", errors, p_path, 0.01)
        max_life = _req_num(preset, "maxLifeTime", errors, p_path, 0.01)
        if min_life > max_life:
            errors.append(f"{p_path}.minLifeTime 不能大于 maxLifeTime")

        _req_num(preset, "emitDuration", errors, p_path, 0.01)
        _req_num(preset, "emitRate", errors, p_path, 1)
        min_power = _req_num(preset, "minEmitPower", errors, p_path, 0.01)
        max_power = _req_num(preset, "maxEmitPower", errors, p_path, 0.01)
        if min_power > max_power:
            errors.append(f"{p_path}.minEmitPower 不能大于 maxEmitPower")

        _req_num(preset, "updateSpeed", errors, p_path, 0.0001)
        _req_num(preset, "gravityY", errors, p_path)

        for vec_name in ("minEmitBox", "maxEmitBox", "direction1", "direction2"):
            vec = _req_obj(preset, vec_name, errors, p_path)
            for axis in ("x", "y", "z"):
                _req_num(vec, axis, errors, f"{p_path}.{vec_name}")

        colors = preset.get("colorGradients")
        if not isinstance(colors, list):
            errors.append(f"{p_path}.colorGradients 必须是数组")
        else:
            for idx, entry in enumerate(colors):
                c_path = f"{p_path}.colorGradients[{idx}]"
                if not isinstance(entry, dict):
                    errors.append(f"{c_path} 必须是对象")
                    continue
                _req_num(entry, "offset", errors, c_path, 0, 1)
                color = _req_obj(entry, "color", errors, c_path)
                for channel in ("r", "g", "b", "a"):
                    _req_num(color, channel, errors, f"{c_path}.color", COLOR_MIN, COLOR_MAX)

        sizes = preset.get("sizeGradients")
        if not isinstance(sizes, list):
            errors.append(f"{p_path}.sizeGradients 必须是数组")
        else:
            for idx, entry in enumerate(sizes):
                s_path = f"{p_path}.sizeGradients[{idx}]"
                if not isinstance(entry, dict):
                    errors.append(f"{s_path} 必须是对象")
                    continue
                _req_num(entry, "offset", errors, s_path, 0, 1)
                _req_num(entry, "size", errors, s_path, 0.0001)

    return errors

def validate_sprite_animation_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body 必须是 JSON 对象"]

    rigs = payload.get("rigs")
    clips = payload.get("clips")
    if not isinstance(rigs, dict):
        errors.append("rigs 必须是对象")
        rigs = {}
    if not isinstance(clips, dict):
        errors.append("clips 必须是对象")
        clips = {}

    for key, rig in rigs.items():
        p_path = f"rigs[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("rigs 的 key 必须是非空字符串")
            continue
        if not isinstance(rig, dict):
            errors.append(f"{p_path} 必须是对象")
            continue
        rig_id = _req_str(rig, "rigId", errors, p_path)
        if rig_id and rig_id != key:
            errors.append(f"{p_path}.rigId 必须与 key 一致")
        _req_str(rig, "atlasJsonPath", errors, p_path)
        _req_str(rig, "atlasImagePath", errors, p_path)
        if rig.get("baseSize") is not None:
            _req_num(rig, "baseSize", errors, p_path, 0.01)
        parts = rig.get("parts")
        if not isinstance(parts, list) or len(parts) == 0:
            errors.append(f"{p_path}.parts 至少需要一个部件")
            continue
        seen = set()
        for idx, part in enumerate(parts):
            part_path = f"{p_path}.parts[{idx}]"
            if not isinstance(part, dict):
                errors.append(f"{part_path} 必须是对象")
                continue
            part_id = _req_str(part, "partId", errors, part_path)
            if part_id:
                if part_id in seen:
                    errors.append(f"{p_path} 重复 partId: {part_id}")
                seen.add(part_id)
            for optional_str in ("atlasJsonPath", "atlasImagePath", "defaultFrameName", "label"):
                if part.get(optional_str) is not None and not isinstance(part.get(optional_str), str):
                    errors.append(f"{part_path}.{optional_str} 必须是字符串")
            if part.get("zIndex") is not None:
                _req_num(part, "zIndex", errors, part_path)
            transform = part.get("transform")
            if transform is not None:
                if not isinstance(transform, dict):
                    errors.append(f"{part_path}.transform 必须是对象")
                else:
                    for field in ("x", "y", "rotationDeg", "scaleX", "scaleY"):
                        if transform.get(field) is not None:
                            _req_num(transform, field, errors, f"{part_path}.transform")

    for key, clip in clips.items():
        p_path = f"clips[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("clips 的 key 必须是非空字符串")
            continue
        if not isinstance(clip, dict):
            errors.append(f"{p_path} 必须是对象")
            continue
        clip_id = _req_str(clip, "clipId", errors, p_path)
        if clip_id and clip_id != key:
            errors.append(f"{p_path}.clipId 必须与 key 一致")
        rig_id = _req_str(clip, "rigId", errors, p_path)
        if rig_id and rig_id not in rigs:
            errors.append(f"{p_path}.rigId 引用了不存在的 rig: {rig_id}")
        _req_num(clip, "fps", errors, p_path, 0.01)
        if clip.get("duration") is not None:
            _req_num(clip, "duration", errors, p_path, 0)
        if not isinstance(clip.get("loop"), bool):
            errors.append(f"{p_path}.loop 必须是布尔值")
        keys = clip.get("keys")
        if not isinstance(keys, list):
            errors.append(f"{p_path}.keys 必须是数组")
            continue
        last_time = -1.0
        for idx, keyframe in enumerate(keys):
            k_path = f"{p_path}.keys[{idx}]"
            if not isinstance(keyframe, dict):
                errors.append(f"{k_path} 必须是对象")
                continue
            time_val = _req_num(keyframe, "time", errors, k_path, 0)
            if time_val < last_time:
                errors.append(f"{p_path}.keys 必须按 time 升序")
            last_time = time_val
            parts = keyframe.get("parts")
            if not isinstance(parts, dict):
                errors.append(f"{k_path}.parts 必须是对象")
                continue
            for part_id, pose in parts.items():
                pose_path = f"{k_path}.parts[{part_id}]"
                if not isinstance(pose, dict):
                    errors.append(f"{pose_path} 必须是对象")
                    continue
                if pose.get("frameName") is not None and not isinstance(pose.get("frameName"), str):
                    errors.append(f"{pose_path}.frameName 必须是字符串")
                if pose.get("visible") is not None and not isinstance(pose.get("visible"), bool):
                    errors.append(f"{pose_path}.visible 必须是布尔值")
                for field in ("x", "y", "rotationDeg", "scaleX", "scaleY"):
                    if pose.get(field) is not None:
                        _req_num(pose, field, errors, pose_path)

    return errors