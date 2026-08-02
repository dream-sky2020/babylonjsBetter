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

def validate_number_sprite_config_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body must be a JSON object"]
    for key, preset in payload.items():
        path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("preset key must be a non-empty string")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{path} must be an object")
            continue
        if preset.get("presetKey") != key:
            errors.append(f"{path}.presetKey must match its object key")
        if not isinstance(preset.get("name"), str) or not preset["name"].strip():
            errors.append(f"{path}.name must be a non-empty string")
        height = preset.get("height")
        spacing = preset.get("spacing")
        if not is_finite_number(height) or height <= 0 or height > 1000:
            errors.append(f"{path}.height must be between 0 and 1000")
        if not is_finite_number(spacing) or spacing < -100 or spacing > 100:
            errors.append(f"{path}.spacing must be between -100 and 100")
        if not isinstance(preset.get("groupingEnabled"), bool):
            errors.append(f"{path}.groupingEnabled must be a boolean")
        grouping_extra_spacing = preset.get("groupingExtraSpacing")
        if not is_finite_number(grouping_extra_spacing) or grouping_extra_spacing < 0 or grouping_extra_spacing > 100:
            errors.append(f"{path}.groupingExtraSpacing must be between 0 and 100")
        if preset.get("alignment") not in ("left", "center", "right"):
            errors.append(f"{path}.alignment must be left, center or right")
        if not isinstance(preset.get("billboard"), bool):
            errors.append(f"{path}.billboard must be a boolean")
        glyphs = preset.get("glyphs")
        if not isinstance(glyphs, dict):
            errors.append(f"{path}.glyphs must be an object")
            continue
        for glyph, source in glyphs.items():
            glyph_path = f"{path}.glyphs[{glyph}]"
            if not isinstance(glyph, str) or len(glyph) != 1:
                errors.append(f"{glyph_path} key must be one character")
            if not isinstance(source, dict):
                errors.append(f"{glyph_path} must be an object")
                continue
            source_type = source.get("type")
            if source_type == "single":
                if not isinstance(source.get("imagePath"), str) or not source["imagePath"].strip():
                    errors.append(f"{glyph_path}.imagePath must be a non-empty string")
            elif source_type == "atlas":
                if not isinstance(source.get("atlasJsonPath"), str) or not source["atlasJsonPath"].strip():
                    errors.append(f"{glyph_path}.atlasJsonPath must be a non-empty string")
                if not isinstance(source.get("frameName"), str) or not source["frameName"].strip():
                    errors.append(f"{glyph_path}.frameName must be a non-empty string")
            else:
                errors.append(f"{glyph_path}.type must be single or atlas")
    return errors

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

def validate_stripe_preset_payload(payload: dict) -> list[str]:
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
        if p_key and p_key != key:
            errors.append(f"{p_path}.presetKey 必须与对象 key 一致")

        _req_num(preset, "angleDeg", errors, p_path, -360, 360)
        _req_num(preset, "speed", errors, p_path, -5000, 5000)
        mode = preset.get("mode")
        if mode is not None:
            if not isinstance(mode, str):
                errors.append(f"{p_path}.mode 必须是字符串")
                mode = "stripes"
            elif mode not in ("stripes", "solid"):
                errors.append(f"{p_path}.mode 仅支持 stripes / solid")
                mode = "stripes"
        else:
            mode = "stripes"

        background = preset.get("background")
        if background is not None and not isinstance(background, str):
            errors.append(f"{p_path}.background 必须是字符串")

        if mode == "solid":
            _req_str(preset, "solidColor", errors, p_path)
            # 纯色模式允许省略 segments
            continue

        segments = preset.get("segments")
        if not isinstance(segments, list) or len(segments) == 0:
            errors.append(f"{p_path}.segments 至少需要 1 段")
            continue

        for idx, segment in enumerate(segments):
            s_path = f"{p_path}.segments[{idx}]"
            if not isinstance(segment, dict):
                errors.append(f"{s_path} 必须是对象")
                continue
            _req_num(segment, "width", errors, s_path, 0.01)
            fill_type = _req_str(segment, "fillType", errors, s_path)
            if fill_type not in ("solid", "gradient"):
                errors.append(f"{s_path}.fillType 仅支持 solid / gradient")
                continue
            if fill_type == "solid":
                _req_str(segment, "color", errors, s_path)
            else:
                _req_str(segment, "fromColor", errors, s_path)
                _req_str(segment, "toColor", errors, s_path)

            opacity = segment.get("opacity")
            if opacity is not None:
                _req_num(segment, "opacity", errors, s_path, 0, 1)

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

def validate_monster_display_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body 必须是 JSON 对象"]

    valid_layer_keys = {"bottomFillMask", "bottomBorder", "body", "line"}
    seen_ids: dict[str, str] = {}

    for key, config in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("root 的 key 必须是非空字符串")
            continue
        if not isinstance(config, dict):
            errors.append(f"{p_path} 必须是对象")
            continue

        cfg_id = _req_str(config, "id", errors, p_path)
        _req_str(config, "name", errors, p_path)
        if cfg_id and cfg_id != key:
            errors.append(f"{p_path}.id 必须与对象 key 一致")
        if cfg_id:
            lowered = cfg_id.lower()
            if lowered in seen_ids and seen_ids[lowered] != key:
                errors.append(f"{p_path}.id 与 {seen_ids[lowered]} 重复（忽略大小写）")
            else:
                seen_ids[lowered] = key

        _req_num(config, "scaleSize", errors, p_path, 1)
        scene3d_scale = config.get("scene3dScale")
        if scene3d_scale is not None:
            _req_num(config, "scene3dScale", errors, p_path, 0.01)
        scene3d_height = config.get("scene3dHeight")
        if scene3d_height is not None:
            _req_num(config, "scene3dHeight", errors, p_path)
        scene3d_offset_x = config.get("scene3dOffsetX")
        if scene3d_offset_x is not None:
            _req_num(config, "scene3dOffsetX", errors, p_path)
        sprite_facing_axis = config.get("spriteFacingAxis")
        if sprite_facing_axis is not None:
            if not isinstance(sprite_facing_axis, str):
                errors.append(f"{p_path}.spriteFacingAxis 必须是字符串")
            elif sprite_facing_axis not in {"+Z", "-Z"}:
                errors.append(f"{p_path}.spriteFacingAxis 仅支持 +Z / -Z")
        stripe_preset_binding = config.get("monsterStripePresetKey")
        if stripe_preset_binding is not None and not isinstance(stripe_preset_binding, str):
            errors.append(f"{p_path}.monsterStripePresetKey 必须是字符串")

        render_order = config.get("renderOrder")
        if not isinstance(render_order, list) or len(render_order) == 0:
            errors.append(f"{p_path}.renderOrder 必须是非空数组")
        else:
            seen = set()
            for idx, layer_key in enumerate(render_order):
                if not isinstance(layer_key, str):
                    errors.append(f"{p_path}.renderOrder[{idx}] 必须是字符串")
                    continue
                if layer_key not in valid_layer_keys:
                    errors.append(f"{p_path}.renderOrder[{idx}] 非法图层 key: {layer_key}")
                if layer_key in seen:
                    errors.append(f"{p_path}.renderOrder 出现重复图层 key: {layer_key}")
                seen.add(layer_key)

        layers = config.get("layers")
        if not isinstance(layers, dict):
            errors.append(f"{p_path}.layers 必须是对象")
            continue

        for layer_key in valid_layer_keys:
            layer = layers.get(layer_key)
            layer_path = f"{p_path}.layers[{layer_key}]"
            if not isinstance(layer, dict):
                errors.append(f"{layer_path} 必须是对象")
                continue
            _req_str(layer, "path", errors, layer_path)
            stripe_key = layer.get("stripePresetKey")
            if stripe_key is not None and not isinstance(stripe_key, str):
                errors.append(f"{layer_path}.stripePresetKey 必须是字符串")

        for provided_key in layers.keys():
            if provided_key not in valid_layer_keys:
                errors.append(f"{p_path}.layers 包含未知图层 key: {provided_key}")

    return errors

def validate_monster_stripe_preset_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body 必须是 JSON 对象"]

    valid_layer_keys = {"bottomFillMask", "bottomBorder", "body", "line"}
    for key, preset in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("root 的 key 必须是非空字符串")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{p_path} 必须是对象")
            continue

        preset_id = _req_str(preset, "id", errors, p_path)
        _req_str(preset, "name", errors, p_path)
        if preset_id and preset_id != key:
            errors.append(f"{p_path}.id 必须与对象 key 一致")

        layers = preset.get("layers")
        if not isinstance(layers, dict):
            errors.append(f"{p_path}.layers 必须是对象")
            continue

        for layer_key in valid_layer_keys:
            layer = layers.get(layer_key)
            layer_path = f"{p_path}.layers[{layer_key}]"
            if not isinstance(layer, dict):
                errors.append(f"{layer_path} 必须是对象")
                continue
            stripe_key = layer.get("stripePresetKey")
            if stripe_key is not None and not isinstance(stripe_key, str):
                errors.append(f"{layer_path}.stripePresetKey 必须是字符串")

        for provided_key in layers.keys():
            if provided_key not in valid_layer_keys:
                errors.append(f"{p_path}.layers 包含未知图层 key: {provided_key}")

    return errors

def validate_pop_number_preset_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body 必须是 JSON 对象"]

    valid_number_modes = {"range", "fixed"}
    valid_pop_modes = {"float", "projectile"}
    for key, preset in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("root 的 key 必须是非空字符串")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{p_path} 必须是对象")
            continue

        preset_key = _req_str(preset, "presetKey", errors, p_path)
        _req_str(preset, "name", errors, p_path)
        if preset_key and preset_key != key:
            errors.append(f"{p_path}.presetKey 必须与对象 key 一致")

        number_mode = _req_str(preset, "numberMode", errors, p_path)
        pop_mode = _req_str(preset, "popMode", errors, p_path)
        if number_mode and number_mode not in valid_number_modes:
            errors.append(f"{p_path}.numberMode 仅支持 range / fixed")
        if pop_mode and pop_mode not in valid_pop_modes:
            errors.append(f"{p_path}.popMode 仅支持 float / projectile")

        min_value = _req_num(preset, "minValue", errors, p_path)
        max_value = _req_num(preset, "maxValue", errors, p_path)
        _req_num(preset, "fixedValue", errors, p_path)
        if min_value > max_value:
            errors.append(f"{p_path}.minValue 不能大于 maxValue")

        _req_num(preset, "lifeMs", errors, p_path, 100)
        if not isinstance(preset.get("enableGlow"), bool):
            errors.append(f"{p_path}.enableGlow 必须是布尔值")

        dir_min = _req_num(preset, "directionMinDeg", errors, p_path)
        dir_max = _req_num(preset, "directionMaxDeg", errors, p_path)
        if dir_min > dir_max:
            errors.append(f"{p_path}.directionMinDeg 不能大于 directionMaxDeg")

        speed_min = _req_num(preset, "speedMin", errors, p_path, 0)
        speed_max = _req_num(preset, "speedMax", errors, p_path, 0)
        if speed_min > speed_max:
            errors.append(f"{p_path}.speedMin 不能大于 speedMax")

        _req_num(preset, "gravity", errors, p_path)

    return errors

def validate_burst_capsule_preset_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body 必须是 JSON 对象"]

    valid_decay_modes = {"fade", "shrink"}
    valid_color_modes = {"single", "random"}
    for key, preset in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("root 的 key 必须是非空字符串")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{p_path} 必须是对象")
            continue

        preset_key = _req_str(preset, "presetKey", errors, p_path)
        _req_str(preset, "name", errors, p_path)
        if preset_key and preset_key != key:
            errors.append(f"{p_path}.presetKey 必须与对象 key 一致")

        controls = _req_obj(preset, "controls", errors, p_path)
        if not controls:
            continue

        _req_num(controls, "spawnCount", errors, f"{p_path}.controls", 1)
        _req_num(controls, "spawnJitter", errors, f"{p_path}.controls", 0)
        speed_min = _req_num(controls, "speedMin", errors, f"{p_path}.controls", 0)
        speed_max = _req_num(controls, "speedMax", errors, f"{p_path}.controls", 0)
        if speed_min > speed_max:
            errors.append(f"{p_path}.controls.speedMin 不能大于 speedMax")

        _req_num(controls, "friction", errors, f"{p_path}.controls", 0)
        decay_min = _req_num(controls, "decayMin", errors, f"{p_path}.controls", 0)
        decay_max = _req_num(controls, "decayMax", errors, f"{p_path}.controls", 0)
        if decay_min > decay_max:
            errors.append(f"{p_path}.controls.decayMin 不能大于 decayMax")

        length_min = _req_num(controls, "lengthMin", errors, f"{p_path}.controls", 0)
        length_max = _req_num(controls, "lengthMax", errors, f"{p_path}.controls", 0)
        if length_min > length_max:
            errors.append(f"{p_path}.controls.lengthMin 不能大于 lengthMax")

        thickness_min = _req_num(controls, "thicknessMin", errors, f"{p_path}.controls", 0)
        thickness_max = _req_num(controls, "thicknessMax", errors, f"{p_path}.controls", 0)
        if thickness_min > thickness_max:
            errors.append(f"{p_path}.controls.thicknessMin 不能大于 thicknessMax")

        _req_num(controls, "outlineWidth", errors, f"{p_path}.controls", 0)
        _req_num(controls, "trailAlpha", errors, f"{p_path}.controls", 0, 1)
        _req_num(controls, "shrinkPower", errors, f"{p_path}.controls", 0.0001)

        decay_mode = _req_str(controls, "decayVisualMode", errors, f"{p_path}.controls")
        if decay_mode and decay_mode not in valid_decay_modes:
            errors.append(f"{p_path}.controls.decayVisualMode 仅支持 fade / shrink")
        color_mode = _req_str(controls, "colorMode", errors, f"{p_path}.controls")
        if color_mode and color_mode not in valid_color_modes:
            errors.append(f"{p_path}.controls.colorMode 仅支持 single / random")
        _req_str(controls, "singleMainColor", errors, f"{p_path}.controls")
        _req_str(controls, "singleStrokeColor", errors, f"{p_path}.controls")

    return errors

def validate_model_scene_preset_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body must be a JSON object"]

    for key, preset in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("preset key must be a non-empty string")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{p_path} must be an object")
            continue
        preset_id = preset.get("id")
        if not isinstance(preset_id, str) or not preset_id.strip():
            errors.append(f"{p_path}.id must be a non-empty string")
        elif preset_id != key:
            errors.append(f"{p_path}.id must match its object key")
        if not isinstance(preset.get("name"), str) or not preset.get("name", "").strip():
            errors.append(f"{p_path}.name must be a non-empty string")
        instances = preset.get("instances")
        if not isinstance(instances, list):
            errors.append(f"{p_path}.instances must be an array")
            continue
        seen_ids: set[str] = set()
        for index, instance in enumerate(instances):
            i_path = f"{p_path}.instances[{index}]"
            if not isinstance(instance, dict):
                errors.append(f"{i_path} must be an object")
                continue
            instance_id = instance.get("id")
            if not isinstance(instance_id, str) or not instance_id.strip():
                errors.append(f"{i_path}.id must be a non-empty string")
            elif instance_id in seen_ids:
                errors.append(f"{i_path}.id is duplicated: {instance_id}")
            else:
                seen_ids.add(instance_id)
            if not isinstance(instance.get("name"), str) or not instance.get("name", "").strip():
                errors.append(f"{i_path}.name must be a non-empty string")
            model_path = instance.get("modelPath")
            if not isinstance(model_path, str) or not model_path.startswith("/resources/") or not model_path.lower().split("?", 1)[0].endswith((".glb", ".gltf")):
                errors.append(f"{i_path}.modelPath must be a /resources/*.glb or *.gltf path")
            transform = instance.get("transform")
            if not isinstance(transform, dict):
                errors.append(f"{i_path}.transform must be an object")
                continue
            for field in ("position", "rotationDeg", "scaling"):
                value = transform.get(field)
                if not isinstance(value, list) or len(value) != 3 or any(not isinstance(item, (int, float)) for item in value):
                    errors.append(f"{i_path}.transform.{field} must contain three numbers")
            scaling = transform.get("scaling")
            if isinstance(scaling, list) and len(scaling) == 3 and any(isinstance(item, (int, float)) and item == 0 for item in scaling):
                errors.append(f"{i_path}.transform.scaling cannot contain zero")
    return errors

def validate_model_shake_preset_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body must be a JSON object"]
    scalar_ranges = {"durationMs": (30, 10000), "frequencyHz": (0.1, 120)}
    channel_ranges = {
        "positionX": 100, "positionY": 100, "positionZ": 100,
        "rotationX": 180, "rotationY": 180, "rotationZ": 180,
        "scaleX": 3, "scaleY": 3, "scaleZ": 3
    }
    for key, preset in payload.items():
        p_path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("preset key must be a non-empty string")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{p_path} must be an object")
            continue
        preset_key = preset.get("presetKey")
        if not isinstance(preset_key, str) or not preset_key.strip():
            errors.append(f"{p_path}.presetKey must be a non-empty string")
        elif preset_key != key:
            errors.append(f"{p_path}.presetKey must match its object key")
        if not isinstance(preset.get("name"), str) or not preset.get("name", "").strip():
            errors.append(f"{p_path}.name must be a non-empty string")
        controls = preset.get("controls")
        if not isinstance(controls, dict):
            errors.append(f"{p_path}.controls must be an object")
            continue
        for field in ("positionEnabled", "rotationEnabled", "scaleEnabled"):
            if field in controls and not isinstance(controls[field], bool):
                errors.append(f"{p_path}.controls.{field} must be a boolean")
        if "mode" in controls and controls["mode"] not in ("wave", "random"):
            errors.append(f"{p_path}.controls.mode must be wave or random")
        for field, (minimum, maximum) in scalar_ranges.items():
            value = controls.get(field)
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                errors.append(f"{p_path}.controls.{field} must be a number")
            elif value < minimum or value > maximum:
                errors.append(f"{p_path}.controls.{field} must be between {minimum} and {maximum}")
        for prefix, limit in channel_ranges.items():
            minimum = controls.get(f"{prefix}Min")
            maximum = controls.get(f"{prefix}Max")
            legacy = controls.get(prefix)
            if legacy is None and prefix.startswith("scale"):
                legacy = controls.get("scale")
            if minimum is None and maximum is None and isinstance(legacy, (int, float)) and not isinstance(legacy, bool):
                continue
            if not isinstance(minimum, (int, float)) or isinstance(minimum, bool):
                errors.append(f"{p_path}.controls.{prefix}Min must be a number")
                continue
            if not isinstance(maximum, (int, float)) or isinstance(maximum, bool):
                errors.append(f"{p_path}.controls.{prefix}Max must be a number")
                continue
            if minimum < -limit or minimum > limit or maximum < -limit or maximum > limit:
                errors.append(f"{p_path}.controls.{prefix} range must be between {-limit} and {limit}")
            elif minimum > maximum:
                errors.append(f"{p_path}.controls.{prefix}Min cannot exceed {prefix}Max")
    return errors

def validate_model_display_config_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return ["body must be a JSON object"]
    for key, config in payload.items():
        path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("model path key must be a non-empty string")
            continue
        if not isinstance(config, dict):
            errors.append(f"{path} must be an object")
            continue
        if config.get("modelPath") != key:
            errors.append(f"{path}.modelPath must match its object key")
        rotation = config.get("rotationDeg")
        if not isinstance(rotation, dict):
            errors.append(f"{path}.rotationDeg must be an object")
        else:
            for axis in ("x", "y", "z"):
                value = rotation.get(axis)
                if not is_finite_number(value) or value < -360 or value > 360:
                    errors.append(f"{path}.rotationDeg.{axis} must be between -360 and 360")
        scale = config.get("scale")
        if not is_finite_number(scale) or scale < 0.001 or scale > 1000:
            errors.append(f"{path}.scale must be between 0.001 and 1000")
        camera_distance = config.get("cameraDistance")
        if not is_finite_number(camera_distance) or camera_distance < 0.01 or camera_distance > 100000:
            errors.append(f"{path}.cameraDistance must be between 0.01 and 100000")
        speed = config.get("rotationSpeedDegPerSec")
        if not is_finite_number(speed) or speed < -720 or speed > 720:
            errors.append(f"{path}.rotationSpeedDegPerSec must be between -720 and 720")
    return errors

def validate_model_swing_config_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict): return ["body must be a JSON object"]
    for key, config in payload.items():
        path = f"root[{key}]"
        if not isinstance(key, str) or not key.strip():
            errors.append("model path key must be a non-empty string")
            continue
        if not isinstance(config, dict):
            errors.append(f"{path} must be an object")
            continue
        if config.get("modelPath") != key:
            errors.append(f"{path}.modelPath must match its object key")
        if not isinstance(config.get("enabled"), bool):
            errors.append(f"{path}.enabled must be a boolean")
        rotation = config.get("baseRotationDeg")
        if not isinstance(rotation, dict):
            errors.append(f"{path}.baseRotationDeg must be an object")
        else:
            for axis in ("x", "y", "z"):
                value = rotation.get(axis)
                if not is_finite_number(value) or value < -360 or value > 360:
                    errors.append(f"{path}.baseRotationDeg.{axis} must be between -360 and 360")
        if config.get("axis") not in ("x", "y", "z"):
            errors.append(f"{path}.axis must be x, y or z")
        minimum, maximum = config.get("minAngleDeg"), config.get("maxAngleDeg")
        if not is_finite_number(minimum) or not is_finite_number(maximum) or minimum < -360 or maximum > 360 or minimum > maximum:
            errors.append(f"{path}.angle range must be between -360 and 360 with minAngleDeg <= maxAngleDeg")
        frequency = config.get("frequencyHz")
        if not is_finite_number(frequency) or frequency < 0.01 or frequency > 30:
            errors.append(f"{path}.frequencyHz must be between 0.01 and 30")
        phase = config.get("phaseDeg")
        if not is_finite_number(phase) or phase < -360 or phase > 360:
            errors.append(f"{path}.phaseDeg must be between -360 and 360")
    return errors

def _validate_particle_ref(config: dict, path: str, errors: list[str], field: str) -> None:
    value = config.get(field)
    if not isinstance(value, str) or not value.strip(): errors.append(f"{path}.{field} must be a non-empty particle preset key")

def validate_model_shoot_config_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict): return ["body must be a JSON object"]
    for key, config in payload.items():
        path = f"root[{key}]"
        if not isinstance(config, dict): errors.append(f"{path} must be an object"); continue
        if config.get("modelPath") != key: errors.append(f"{path}.modelPath must match its object key")
        _validate_particle_ref(config, path, errors, "fireParticlePresetKey")
        for field, minimum, maximum in (("fireIntervalMs", 1, 60000), ("recoilAngleDeg", -180, 180), ("particleOffsetX", -100, 100), ("particleOffsetY", -100, 100), ("particleOffsetZ", -100, 100)):
            if not is_finite_number(config.get(field)) or config[field] < minimum or config[field] > maximum: errors.append(f"{path}.{field} out of range")
    return errors

def validate_bullet_config_payload(payload: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict): return ["body must be a JSON object"]
    for key, config in payload.items():
        path = f"root[{key}]"
        if not isinstance(config, dict): errors.append(f"{path} must be an object"); continue
        if config.get("bulletKey") != key: errors.append(f"{path}.bulletKey must match its object key")
        if config.get("shape") not in ("sphere", "box", "cylinder"): errors.append(f"{path}.shape must be sphere, box or cylinder")
        _validate_particle_ref(config, path, errors, "trailParticlePresetKey")
        for field, minimum, maximum in (("scale", 0.01, 100), ("speed", 0.01, 1000), ("trailLength", 0, 100), ("trailWidth", 0.001, 100)):
            if not is_finite_number(config.get(field)) or config[field] < minimum or config[field] > maximum: errors.append(f"{path}.{field} out of range")
    return errors
