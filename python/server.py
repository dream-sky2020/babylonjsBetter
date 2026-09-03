# server.py
import argparse
import mimetypes
import os
import json
import socket
import re
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# 导入抽离出去的工具和计算逻辑
from utils import (
    normalize_slashes, to_resource_path, to_public_path, is_path_inside, is_finite_number,
    is_allowed_image_file, validate_sprite_anchor_payload, validate_particle_effect_payload,
    validate_particle_preset_payload, validate_particle_visual_preset_payload,
    validate_sprite_animation_payload, validate_stripe_preset_payload, validate_monster_display_payload,
    validate_monster_stripe_preset_payload, validate_pop_number_preset_payload,
    validate_burst_capsule_preset_payload, validate_model_scene_preset_payload,
    validate_model_shake_preset_payload, validate_model_display_config_payload,
    validate_model_asset_profile_payload,
    validate_model_swing_config_payload, validate_model_shoot_config_payload,
    validate_bullet_config_payload,
    validate_number_sprite_config_payload, validate_exclamation_mark_preset_payload,
    validate_monster_exclamation_position_payload, validate_special_status_visual_preset_payload,
    validate_monster_special_status_position_payload, validate_monster_battlefield_formation_payload,
    validate_monster_battlefield_stripe_rule_payload, validate_monster_movement_config_payload,
    validate_monster_attack_config_payload, validate_monster_death_config_payload, validate_sprite_ash_preset_payload, validate_monster_status_particle_config_payload,
    validate_avatar_config_payload, validate_dungeon_map_preset_payload, validate_world_preset_payload
)

app = Flask(__name__)
CORS(app)

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(PROJECT_DIR, ".."))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
PUBLIC_RESOURCES_DIR = os.path.join(PUBLIC_DIR, "resources")
SPRITE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "spriteAnchorPresets.json")
SPRITE_ANIMATION_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "spriteAnimationLibrary.json")
NUMBER_SPRITE_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "numberSpriteConfigs.json")
EXCLAMATION_MARK_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "exclamationMarkPresets.json")
EXCLAMATION_BASE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "exclamationBasePresets.json")
MONSTER_EXCLAMATION_POSITION_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterExclamationPositions.json")
SPECIAL_STATUS_VISUAL_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "specialStatusVisualPresets.json")
MONSTER_SPECIAL_STATUS_POSITION_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterSpecialStatusPositions.json")
MONSTER_BATTLEFIELD_FORMATION_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterBattlefieldFormations.json")
MONSTER_BATTLEFIELD_STRIPE_RULE_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterBattlefieldStripeRules.json")
MONSTER_MOVEMENT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterMovementConfigs.json")
MONSTER_ATTACK_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterAttackConfigs.json")
MONSTER_DEATH_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterDeathConfigs.json")
SPRITE_ASH_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "spriteAshPresets.json")
MONSTER_DISSOLVE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterDissolvePresets.json")
MONSTER_STATUS_PARTICLE_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterStatusParticleConfigs.json")
PARTICLE_EFFECT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "particleEffects.json")
PARTICLE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "particlePresets.json")
PARTICLE_VISUAL_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "particleVisualPresets.json")
STRIPE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "stripePresets.json")
MONSTER_DISPLAY_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterDisplayConfigs.json")
MONSTER_STRIPE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "monsterStripePresets.json")
POP_NUMBER_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "popNumberPresets.json")
BURST_CAPSULE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "burstCapsulePresets.json")
MODEL_SCENE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "modelScenePresets.json")
MODEL_SHAKE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "modelShakePresets.json")
MODEL_DISPLAY_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "modelDisplayConfigs.json")
MODEL_ASSET_PROFILE_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "modelAssetProfiles.json")
MODEL_SWING_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "modelSwingConfigs.json")
MODEL_SHOOT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "modelShootConfigs.json")
BULLET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "bulletConfigs.json")
AVATAR_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "avatarConfigs.json")
DUNGEON_MAP_PRESET_CONFIG_DIR = os.path.join(PROJECT_ROOT, "config", "dungeonMapPresets")
DUNGEON_MAP_PRESET_INDEX_PATH = os.path.join(DUNGEON_MAP_PRESET_CONFIG_DIR, "index.json")
WORLD_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "worldPresets.json")
SCENE_ENVIRONMENT_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "sceneEnvironmentPresets.json")
SHADOW_QUALITY_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "shadowQualityPresets.json")
IMAGE_DIR = os.path.join(PROJECT_DIR, "Identity_Skill_Icons")
DEV_PORT_MIN = 4550
DEV_PORT_MAX = 4600
DEV_PORT_MAX_ATTEMPTS = 50

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "imageDir": normalize_slashes(IMAGE_DIR), "publicDir": normalize_slashes(PUBLIC_DIR)})

@app.route("/resources/<path:relative_path>", methods=["GET"])
def serve_public_resource(relative_path: str):
    safe_path = os.path.normpath(relative_path).replace("\\", "/")
    if safe_path.startswith("..") or "/.." in safe_path: return "Invalid path", 400
    if not is_allowed_image_file(safe_path): return "Only image files are allowed", 403
    return send_from_directory(PUBLIC_RESOURCES_DIR, safe_path)

@app.route("/api/images", methods=["GET"])
def list_images():
    if not os.path.isdir(IMAGE_DIR): return jsonify({"success": False, "message": f"目录不存在: {IMAGE_DIR}"}), 404
    result = []
    for root, _, files in os.walk(IMAGE_DIR):
        for file_name in files:
            full_path = os.path.join(root, file_name)
            if not is_allowed_image_file(full_path): continue
            rel_path = normalize_slashes(os.path.relpath(full_path, IMAGE_DIR))
            result.append({
                "name": file_name, "relativePath": rel_path,
                "url": f"/images/{rel_path}", "absolutePath": normalize_slashes(os.path.abspath(full_path))
            })
    result.sort(key=lambda item: item["relativePath"])
    return jsonify({"success": True, "count": len(result), "items": result})

@app.route("/api/model-scene-presets", methods=["GET", "PUT"])
def handle_model_scene_presets():
    if request.method == "GET":
        if not os.path.isfile(MODEL_SCENE_PRESET_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(MODEL_SCENE_PRESET_CONFIG_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "config root must be an object"}), 500
            errors = validate_model_scene_preset_payload(data)
            return jsonify({"success": True, "count": len(data), "data": data, "valid": len(errors) == 0, "errors": errors[:50]})
        except Exception as exc:
            return jsonify({"success": False, "message": f"failed to read scene presets: {exc}"}), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"success": False, "message": "body must be a JSON object"}), 400
    errors = validate_model_scene_preset_payload(payload)
    if errors:
        return jsonify({"success": False, "message": "scene preset validation failed", "errorCount": len(errors), "errors": errors[:50]}), 400
    try:
        os.makedirs(os.path.dirname(MODEL_SCENE_PRESET_CONFIG_PATH), exist_ok=True)
        temp_path = f"{MODEL_SCENE_PRESET_CONFIG_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(temp_path, MODEL_SCENE_PRESET_CONFIG_PATH)
        return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(MODEL_SCENE_PRESET_CONFIG_PATH)})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to write scene presets: {exc}"}), 500

@app.route("/api/model-asset-profiles", methods=["GET", "PUT"])
def handle_model_asset_profiles():
    if request.method == "GET":
        if not os.path.isfile(MODEL_ASSET_PROFILE_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(MODEL_ASSET_PROFILE_CONFIG_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
            errors = validate_model_asset_profile_payload(data)
            return jsonify({"success": True, "count": len(data), "data": data, "valid": len(errors) == 0, "errors": errors[:50]})
        except Exception as exc:
            return jsonify({"success": False, "message": f"failed to read model asset profiles: {exc}"}), 500

    payload = request.get_json(silent=True)
    errors = validate_model_asset_profile_payload(payload)
    if errors:
        return jsonify({"success": False, "message": "model asset profile validation failed", "errorCount": len(errors), "errors": errors[:50]}), 400
    try:
        os.makedirs(os.path.dirname(MODEL_ASSET_PROFILE_CONFIG_PATH), exist_ok=True)
        temp_path = f"{MODEL_ASSET_PROFILE_CONFIG_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(temp_path, MODEL_ASSET_PROFILE_CONFIG_PATH)
        return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(MODEL_ASSET_PROFILE_CONFIG_PATH)})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to write model asset profiles: {exc}"}), 500

@app.route("/api/model-shake-presets", methods=["GET", "PUT"])
def handle_model_shake_presets():
    if request.method == "GET":
        if not os.path.isfile(MODEL_SHAKE_PRESET_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(MODEL_SHAKE_PRESET_CONFIG_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "config root must be an object"}), 500
            errors = validate_model_shake_preset_payload(data)
            return jsonify({"success": True, "count": len(data), "data": data, "valid": len(errors) == 0, "errors": errors[:50]})
        except Exception as exc:
            return jsonify({"success": False, "message": f"failed to read shake presets: {exc}"}), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"success": False, "message": "body must be a JSON object"}), 400
    errors = validate_model_shake_preset_payload(payload)
    if errors:
        return jsonify({"success": False, "message": "shake preset validation failed", "errorCount": len(errors), "errors": errors[:50]}), 400
    try:
        os.makedirs(os.path.dirname(MODEL_SHAKE_PRESET_CONFIG_PATH), exist_ok=True)
        temp_path = f"{MODEL_SHAKE_PRESET_CONFIG_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(temp_path, MODEL_SHAKE_PRESET_CONFIG_PATH)
        return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(MODEL_SHAKE_PRESET_CONFIG_PATH)})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to write shake presets: {exc}"}), 500

@app.route("/api/model-display-configs", methods=["GET", "PUT"])
def handle_model_display_configs():
    if request.method == "GET":
        if not os.path.isfile(MODEL_DISPLAY_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(MODEL_DISPLAY_CONFIG_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
            errors = validate_model_display_config_payload(data)
            return jsonify({"success": True, "count": len(data), "data": data, "valid": len(errors) == 0, "errors": errors[:50]})
        except Exception as exc:
            return jsonify({"success": False, "message": f"failed to read model display configs: {exc}"}), 500
    payload = request.get_json(silent=True)
    errors = validate_model_display_config_payload(payload)
    if errors:
        return jsonify({"success": False, "message": "model display config validation failed", "errorCount": len(errors), "errors": errors[:50]}), 400
    try:
        os.makedirs(os.path.dirname(MODEL_DISPLAY_CONFIG_PATH), exist_ok=True)
        temp_path = f"{MODEL_DISPLAY_CONFIG_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(temp_path, MODEL_DISPLAY_CONFIG_PATH)
        return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(MODEL_DISPLAY_CONFIG_PATH)})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to write model display configs: {exc}"}), 500

@app.route("/api/model-swing-configs", methods=["GET", "PUT"])
def handle_model_swing_configs():
    if request.method == "GET":
        if not os.path.isfile(MODEL_SWING_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(MODEL_SWING_CONFIG_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
            errors = validate_model_swing_config_payload(data)
            return jsonify({"success": True, "count": len(data), "data": data, "valid": len(errors) == 0, "errors": errors[:50]})
        except Exception as exc:
            return jsonify({"success": False, "message": f"failed to read model swing configs: {exc}"}), 500
    payload = request.get_json(silent=True)
    errors = validate_model_swing_config_payload(payload)
    if errors:
        return jsonify({"success": False, "message": "model swing config validation failed", "errorCount": len(errors), "errors": errors[:50]}), 400
    try:
        os.makedirs(os.path.dirname(MODEL_SWING_CONFIG_PATH), exist_ok=True)
        temp_path = f"{MODEL_SWING_CONFIG_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(temp_path, MODEL_SWING_CONFIG_PATH)
        return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(MODEL_SWING_CONFIG_PATH)})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to write model swing configs: {exc}"}), 500

def _handle_json_config(path: str, validator, label: str):
    if request.method == "GET":
        if not os.path.isfile(path): return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(path, "r", encoding="utf-8") as file: data = json.load(file)
            errors = validator(data)
            return jsonify({"success": True, "count": len(data), "data": data, "valid": len(errors) == 0, "errors": errors[:50]})
        except Exception as exc:
            return jsonify({"success": False, "message": f"failed to read {label}: {exc}"}), 500
    payload = request.get_json(silent=True)
    errors = validator(payload)
    if errors: return jsonify({"success": False, "message": f"{label} validation failed", "errors": errors[:50]}), 400
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True); temp_path = f"{path}.tmp"
        with open(temp_path, "w", encoding="utf-8") as file: json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)
        return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(path)})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to write {label}: {exc}"}), 500

def _validate_exclamation_progress(progress, path: str, errors: list[str]):
    if not isinstance(progress, dict):
        errors.append(f"{path} must be an object")
        return
    if not isinstance(progress.get("enabled"), bool): errors.append(f"{path}.enabled must be a boolean")
    value = progress.get("progress")
    if not is_finite_number(value) or not 0 <= value <= 1: errors.append(f"{path}.progress must be between 0 and 1")
    if progress.get("shape") not in ("none", "linear", "radial", "sector", "ring", "diamond", "box", "rect-perimeter"): errors.append(f"{path}.shape is invalid")
    if progress.get("direction") not in ("forward", "reverse", "center-out", "edges-in"): errors.append(f"{path}.direction is invalid")
    for field in ("angleDeg", "startAngleDeg", "sweepAngleDeg", "innerRadius", "outerRadius", "softness"):
        if field in progress and not is_finite_number(progress.get(field)): errors.append(f"{path}.{field} must be a finite number")
    for field in ("centerOffsetPx", "axisScale"):
        if field not in progress: continue
        vector = progress.get(field)
        if not isinstance(vector, dict) or not is_finite_number(vector.get("x")) or not is_finite_number(vector.get("y")): errors.append(f"{path}.{field} must contain finite x and y numbers")
    for field in ("filled", "unfilled"):
        style = progress.get(field)
        if not isinstance(style, dict): errors.append(f"{path}.{field} must be an object"); continue
        if style.get("source") not in ("color", "texture"): errors.append(f"{path}.{field}.source must be color or texture")
        if not isinstance(style.get("color"), str): errors.append(f"{path}.{field}.color must be a string")
        opacity = style.get("opacity")
        if not is_finite_number(opacity) or not 0 <= opacity <= 1: errors.append(f"{path}.{field}.opacity must be between 0 and 1")

def _validate_current_exclamation_marks(payload) -> list[str]:
    if not isinstance(payload, dict): return ["body must be a JSON object"]
    errors: list[str] = []
    for key, preset in payload.items():
        path = f"root[{key}]"
        if not isinstance(preset, dict): errors.append(f"{path} must be an object"); continue
        if preset.get("presetKey") != key: errors.append(f"{path}.presetKey must match its object key")
        if not isinstance(preset.get("name"), str) or not preset.get("name", "").strip(): errors.append(f"{path}.name must be a non-empty string")
        if not isinstance(preset.get("imagePath"), str): errors.append(f"{path}.imagePath must be a string")
        if preset.get("sizeMode", "preserve-aspect") not in ("fixed", "preserve-aspect"): errors.append(f"{path}.sizeMode is invalid")
        for field in ("width", "height", "scale", "scaleX", "scaleY"):
            if field in preset and (not is_finite_number(preset.get(field)) or preset[field] <= 0): errors.append(f"{path}.{field} must be greater than 0")
        position = preset.get("position")
        if not isinstance(position, list) or len(position) != 3 or any(not is_finite_number(item) for item in position): errors.append(f"{path}.position must contain three finite numbers")
        if not isinstance(preset.get("faceCamera"), bool): errors.append(f"{path}.faceCamera must be a boolean")
        if "progress" in preset: _validate_exclamation_progress(preset.get("progress"), f"{path}.progress", errors)
        else: errors.extend(validate_exclamation_mark_preset_payload({key: preset}))
    return errors

def _validate_current_exclamation_bases(payload) -> list[str]:
    if not isinstance(payload, dict): return ["body must be a JSON object"]
    errors: list[str] = []
    for key, preset in payload.items():
        path = f"root[{key}]"
        if not isinstance(preset, dict): errors.append(f"{path} must be an object"); continue
        if preset.get("presetKey") != key: errors.append(f"{path}.presetKey must match its object key")
        if not isinstance(preset.get("name"), str) or not preset.get("name", "").strip(): errors.append(f"{path}.name must be a non-empty string")
        if not isinstance(preset.get("enabled"), bool): errors.append(f"{path}.enabled must be a boolean")
        if not isinstance(preset.get("imagePath"), str): errors.append(f"{path}.imagePath must be a string")
        if preset.get("sizeMode") not in ("fixed", "preserve-aspect"): errors.append(f"{path}.sizeMode is invalid")
        for field in ("width", "height", "scale", "scaleX", "scaleY"):
            if not is_finite_number(preset.get(field)) or preset[field] <= 0: errors.append(f"{path}.{field} must be greater than 0")
        offset = preset.get("offset")
        if not isinstance(offset, list) or len(offset) != 3 or any(not is_finite_number(item) for item in offset): errors.append(f"{path}.offset must contain three finite numbers")
        _validate_exclamation_progress(preset.get("progress"), f"{path}.progress", errors)
    return errors

@app.route("/api/model-shoot-configs", methods=["GET", "PUT"])
def handle_model_shoot_configs():
    return _handle_json_config(MODEL_SHOOT_CONFIG_PATH, validate_model_shoot_config_payload, "model shoot configs")

@app.route("/api/bullet-configs", methods=["GET", "PUT"])
def handle_bullet_configs():
    return _handle_json_config(BULLET_CONFIG_PATH, validate_bullet_config_payload, "bullet configs")

@app.route("/api/avatar-configs", methods=["GET", "PUT"])
def handle_avatar_configs():
    return _handle_json_config(AVATAR_CONFIG_PATH, validate_avatar_config_payload, "avatar configs")

@app.route("/api/exclamation-mark-presets", methods=["GET", "PUT"])
def handle_exclamation_mark_presets():
    return _handle_json_config(EXCLAMATION_MARK_PRESET_CONFIG_PATH, _validate_current_exclamation_marks, "exclamation mark presets")

@app.route("/api/exclamation-base-presets", methods=["GET", "PUT"])
def handle_exclamation_base_presets():
    return _handle_json_config(EXCLAMATION_BASE_PRESET_CONFIG_PATH, _validate_current_exclamation_bases, "exclamation base presets")

@app.route("/api/monster-exclamation-positions", methods=["GET", "PUT"])
def handle_monster_exclamation_positions():
    return _handle_json_config(MONSTER_EXCLAMATION_POSITION_CONFIG_PATH, validate_monster_exclamation_position_payload, "monster exclamation positions")

@app.route("/api/monster-battlefield-formations", methods=["GET", "PUT"])
def handle_monster_battlefield_formations():
    return _handle_json_config(MONSTER_BATTLEFIELD_FORMATION_CONFIG_PATH, validate_monster_battlefield_formation_payload, "monster battlefield formations")

@app.route("/api/monster-battlefield-stripe-rules", methods=["GET", "PUT"])
def handle_monster_battlefield_stripe_rules():
    return _handle_json_config(MONSTER_BATTLEFIELD_STRIPE_RULE_CONFIG_PATH, validate_monster_battlefield_stripe_rule_payload, "monster battlefield stripe rules")

@app.route("/api/monster-movement-configs", methods=["GET", "PUT"])
def handle_monster_movement_configs():
    return _handle_json_config(MONSTER_MOVEMENT_CONFIG_PATH, validate_monster_movement_config_payload, "monster movement configs")

@app.route("/api/monster-attack-configs", methods=["GET", "PUT"])
def handle_monster_attack_configs():
    return _handle_json_config(MONSTER_ATTACK_CONFIG_PATH, validate_monster_attack_config_payload, "monster attack configs")
@app.route("/api/monster-death-configs", methods=["GET", "PUT"])
def handle_monster_death_configs():
    return _handle_json_config(MONSTER_DEATH_CONFIG_PATH, validate_monster_death_config_payload, "monster death configs")
@app.route("/api/sprite-ash-presets", methods=["GET", "PUT"])
def handle_sprite_ash_presets():
    return _handle_json_config(SPRITE_ASH_PRESET_CONFIG_PATH, validate_sprite_ash_preset_payload, "sprite ash presets")
@app.route("/api/monster-dissolve-presets", methods=["GET", "PUT"])
def handle_monster_dissolve_presets():
    return _handle_json_config(MONSTER_DISSOLVE_PRESET_CONFIG_PATH, validate_sprite_ash_preset_payload, "monster dissolve presets")
def _read_dungeon_map_catalog():
    if not os.path.isfile(DUNGEON_MAP_PRESET_INDEX_PATH):
        return {"version": 1, "presets": {}}
    with open(DUNGEON_MAP_PRESET_INDEX_PATH, "r", encoding="utf-8") as file:
        catalog = json.load(file)
    if not isinstance(catalog, dict) or catalog.get("version") != 1 or not isinstance(catalog.get("presets"), dict):
        raise ValueError("dungeon map preset index is invalid")
    return catalog

def _dungeon_map_preset_file_name(preset_key: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", preset_key):
        raise ValueError(f'dungeon map preset key "{preset_key}" is not storage-safe')
    return f"{preset_key}.json"

@app.route("/api/dungeon-map-presets", methods=["GET", "PUT"])
def handle_dungeon_map_presets():
    if request.method == "GET":
        try:
            catalog = _read_dungeon_map_catalog()
            return jsonify({"success": True, "count": len(catalog["presets"]), "data": catalog})
        except Exception as exc:
            return jsonify({"success": False, "message": f"failed to read dungeon map preset index: {exc}"}), 500

    payload = request.get_json(silent=True)
    errors = validate_dungeon_map_preset_payload(payload)
    if not errors and isinstance(payload, dict):
        for preset_key in payload:
            try: _dungeon_map_preset_file_name(preset_key)
            except ValueError as exc: errors.append(str(exc))
    if errors:
        return jsonify({"success": False, "message": "dungeon map presets validation failed", "errors": errors[:50]}), 400
    try:
        os.makedirs(DUNGEON_MAP_PRESET_CONFIG_DIR, exist_ok=True)
        catalog = {"version": 1, "presets": {}}
        expected_files = {"index.json"}
        for preset_key, preset in payload.items():
            file_name = _dungeon_map_preset_file_name(preset_key)
            expected_files.add(file_name)
            catalog["presets"][preset_key] = {
                "presetKey": preset_key,
                "name": preset["name"],
                "file": file_name,
            }
            preset_path = os.path.join(DUNGEON_MAP_PRESET_CONFIG_DIR, file_name)
            temp_path = f"{preset_path}.tmp"
            with open(temp_path, "w", encoding="utf-8") as file:
                json.dump(preset, file, ensure_ascii=False, indent=2)
            os.replace(temp_path, preset_path)

        index_temp_path = f"{DUNGEON_MAP_PRESET_INDEX_PATH}.tmp"
        with open(index_temp_path, "w", encoding="utf-8") as file:
            json.dump(catalog, file, ensure_ascii=False, indent=2)
        os.replace(index_temp_path, DUNGEON_MAP_PRESET_INDEX_PATH)

        for file_name in os.listdir(DUNGEON_MAP_PRESET_CONFIG_DIR):
            if file_name.endswith(".json") and file_name not in expected_files:
                os.remove(os.path.join(DUNGEON_MAP_PRESET_CONFIG_DIR, file_name))
        return jsonify({
            "success": True,
            "count": len(payload),
            "path": normalize_slashes(DUNGEON_MAP_PRESET_CONFIG_DIR),
        })
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to write dungeon map presets: {exc}"}), 500

@app.route("/api/dungeon-map-presets/<preset_key>", methods=["GET"])
def handle_dungeon_map_preset(preset_key: str):
    try:
        catalog = _read_dungeon_map_catalog()
        entry = catalog["presets"].get(preset_key)
        if not isinstance(entry, dict):
            return jsonify({"success": False, "message": f'dungeon map preset "{preset_key}" does not exist'}), 404
        file_name = entry.get("file")
        if file_name != _dungeon_map_preset_file_name(preset_key):
            raise ValueError(f'dungeon map preset "{preset_key}" file does not match its key')
        preset_path = os.path.join(DUNGEON_MAP_PRESET_CONFIG_DIR, file_name)
        with open(preset_path, "r", encoding="utf-8") as file:
            preset = json.load(file)
        errors = validate_dungeon_map_preset_payload({preset_key: preset})
        if errors:
            return jsonify({"success": False, "message": "dungeon map preset validation failed", "errors": errors[:50]}), 500
        return jsonify({"success": True, "data": preset})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to read dungeon map preset: {exc}"}), 500

@app.route("/api/world-presets", methods=["GET", "PUT"])
def handle_world_presets():
    return _handle_json_config(WORLD_PRESET_CONFIG_PATH, validate_world_preset_payload, "world presets")

@app.route("/api/scene-environment-presets", methods=["GET"])
def handle_scene_environment_presets():
    if not os.path.isfile(SCENE_ENVIRONMENT_PRESET_CONFIG_PATH):
        return jsonify({"success": True, "count": 0, "data": {}})
    try:
        with open(SCENE_ENVIRONMENT_PRESET_CONFIG_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
        if not isinstance(data, dict):
            return jsonify({"success": False, "message": "scene environment preset root must be an object"}), 500
        return jsonify({"success": True, "count": len(data), "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to read scene environment presets: {exc}"}), 500

@app.route("/api/shadow-quality-presets", methods=["GET"])
def handle_shadow_quality_presets():
    if not os.path.isfile(SHADOW_QUALITY_PRESET_CONFIG_PATH):
        return jsonify({"success": True, "count": 0, "data": {}})
    try:
        with open(SHADOW_QUALITY_PRESET_CONFIG_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
        if not isinstance(data, dict):
            return jsonify({"success": False, "message": "shadow quality preset root must be an object"}), 500
        return jsonify({"success": True, "count": len(data), "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": f"failed to read shadow quality presets: {exc}"}), 500
@app.route("/api/monster-status-particle-configs", methods=["GET", "PUT"])
def handle_monster_status_particle_configs():
    return _handle_json_config(MONSTER_STATUS_PARTICLE_CONFIG_PATH, validate_monster_status_particle_config_payload, "monster status particle configs")
@app.route("/api/special-status-visual-presets", methods=["GET", "PUT"])
def handle_special_status_visual_presets():
    return _handle_json_config(SPECIAL_STATUS_VISUAL_PRESET_CONFIG_PATH, validate_special_status_visual_preset_payload, "special status visual presets")

@app.route("/api/monster-special-status-positions", methods=["GET", "PUT"])
def handle_monster_special_status_positions():
    return _handle_json_config(MONSTER_SPECIAL_STATUS_POSITION_CONFIG_PATH, validate_monster_special_status_position_payload, "monster special status positions")

@app.route("/api/find_resource_by_name", methods=["GET"])
def find_resource_by_name():
    file_name = request.args.get("name", "").strip()
    if not file_name: return jsonify({"success": False, "message": "missing name"}), 400
    if not is_allowed_image_file(file_name): return jsonify({"success": False, "message": "Only image files are allowed"}), 403

    if os.path.isdir(PUBLIC_DIR):
        for root, _, files in os.walk(PUBLIC_DIR):
            for current_name in files:
                if current_name.lower() != file_name.lower(): continue
                full_path = os.path.join(root, current_name)
                p_path = to_public_path(os.path.relpath(full_path, PUBLIC_DIR))
                res_path = p_path if p_path.startswith("resources/") else to_resource_path(p_path)
                return jsonify({
                    "success": True, "name": current_name, "relativePath": p_path,
                    "publicPath": p_path, "resourcePath": res_path, "url": f"/{p_path}",
                    "absolutePath": normalize_slashes(os.path.abspath(full_path))
                })
    return jsonify({"success": False, "message": "not found"}), 404

@app.route("/api/sprite-anchor-presets", methods=["GET", "PUT"])
def handle_sprite_anchor_presets():
    # 将 GET 和 PUT 路由合并，进一步压缩结构
    if request.method == "GET":

        if not os.path.isfile(SPRITE_PRESET_CONFIG_PATH): return jsonify({"success": True, "count": 0, "data": {}})
        
        try:
            with open(SPRITE_PRESET_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            # --- 在 GET 返回前进行数据校验 ---
            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500
                
            errors = validate_sprite_anchor_payload(data)
            
            # 返回数据中带上校验结果标识 valid 以及具体的错误列表 errors
            return jsonify({
                "success": True, 
                "count": len(data), 
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]  # 最多返回前50条错误防止响应体过大
            })
            # ----------------------------------------

        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500
            
    elif request.method == "PUT":
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict): return jsonify({"success": False, "message": "body must be a json object"}), 400
        
        errors = validate_sprite_anchor_payload(payload)
        if errors: return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400

        try:
            os.makedirs(os.path.dirname(SPRITE_PRESET_CONFIG_PATH), exist_ok=True)
            with open(f"{SPRITE_PRESET_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{SPRITE_PRESET_CONFIG_PATH}.tmp", SPRITE_PRESET_CONFIG_PATH)
            return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(SPRITE_PRESET_CONFIG_PATH)})
        except Exception as exc:
            return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/sprite-animation-library", methods=["GET", "PUT"])
def handle_sprite_animation_library():
    if request.method == "GET":
        if not os.path.isfile(SPRITE_ANIMATION_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {"rigs": {}, "clips": {}}})
        try:
            with open(SPRITE_ANIMATION_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500
            errors = validate_sprite_animation_payload(data)
            rig_count = len(data.get("rigs", {})) if isinstance(data.get("rigs"), dict) else 0
            clip_count = len(data.get("clips", {})) if isinstance(data.get("clips"), dict) else 0
            return jsonify({
                "success": True,
                "count": rig_count + clip_count,
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]
            })
        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500

    elif request.method == "PUT":
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"success": False, "message": "body must be a json object"}), 400
        errors = validate_sprite_animation_payload(payload)
        if errors:
            return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400
        try:
            os.makedirs(os.path.dirname(SPRITE_ANIMATION_CONFIG_PATH), exist_ok=True)
            with open(f"{SPRITE_ANIMATION_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{SPRITE_ANIMATION_CONFIG_PATH}.tmp", SPRITE_ANIMATION_CONFIG_PATH)
            return jsonify({"success": True, "path": normalize_slashes(SPRITE_ANIMATION_CONFIG_PATH)})
        except Exception as exc:
            return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/number-sprite-configs", methods=["GET", "PUT"])
def handle_number_sprite_configs():
    if request.method == "GET":
        if not os.path.isfile(NUMBER_SPRITE_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(NUMBER_SPRITE_CONFIG_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
            errors = validate_number_sprite_config_payload(data)
            return jsonify({
                "success": True,
                "count": len(data) if isinstance(data, dict) else 0,
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]
            })
        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"success": False, "message": "body must be a json object"}), 400
    errors = validate_number_sprite_config_payload(payload)
    if errors:
        return jsonify({"success": False, "message": "配置校验失败", "errors": errors[:50]}), 400
    try:
        os.makedirs(os.path.dirname(NUMBER_SPRITE_CONFIG_PATH), exist_ok=True)
        with open(f"{NUMBER_SPRITE_CONFIG_PATH}.tmp", "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(f"{NUMBER_SPRITE_CONFIG_PATH}.tmp", NUMBER_SPRITE_CONFIG_PATH)
        return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(NUMBER_SPRITE_CONFIG_PATH)})
    except Exception as exc:
        return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/particle-effects", methods=["GET", "PUT"])
def handle_particle_effects():
    return _handle_json_config(PARTICLE_EFFECT_CONFIG_PATH, validate_particle_effect_payload, "particle effects")

@app.route("/api/particle-presets", methods=["GET", "PUT"])
def handle_particle_presets():
    return _handle_json_config(PARTICLE_PRESET_CONFIG_PATH, validate_particle_preset_payload, "particle presets")

@app.route("/api/particle-visual-presets", methods=["GET", "PUT"])
def handle_particle_visual_presets():
    return _handle_json_config(PARTICLE_VISUAL_PRESET_CONFIG_PATH, validate_particle_visual_preset_payload, "particle visual presets")

@app.route("/api/stripe-presets", methods=["GET", "PUT"])
def handle_stripe_presets():
    if request.method == "GET":
        if not os.path.isfile(STRIPE_PRESET_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(STRIPE_PRESET_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500

            errors = validate_stripe_preset_payload(data)
            return jsonify({
                "success": True,
                "count": len(data),
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]
            })
        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500

    elif request.method == "PUT":
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"success": False, "message": "body must be a json object"}), 400

        errors = validate_stripe_preset_payload(payload)
        if errors:
            return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400

        try:
            os.makedirs(os.path.dirname(STRIPE_PRESET_CONFIG_PATH), exist_ok=True)
            with open(f"{STRIPE_PRESET_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{STRIPE_PRESET_CONFIG_PATH}.tmp", STRIPE_PRESET_CONFIG_PATH)
            return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(STRIPE_PRESET_CONFIG_PATH)})
        except Exception as exc:
            return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/monster-display-configs", methods=["GET", "PUT"])
def handle_monster_display_configs():
    if request.method == "GET":
        if not os.path.isfile(MONSTER_DISPLAY_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(MONSTER_DISPLAY_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500

            errors = validate_monster_display_payload(data)
            return jsonify({
                "success": True,
                "count": len(data),
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]
            })
        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500

    elif request.method == "PUT":
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"success": False, "message": "body must be a json object"}), 400

        errors = validate_monster_display_payload(payload)
        if errors:
            return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400

        try:
            os.makedirs(os.path.dirname(MONSTER_DISPLAY_CONFIG_PATH), exist_ok=True)
            with open(f"{MONSTER_DISPLAY_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{MONSTER_DISPLAY_CONFIG_PATH}.tmp", MONSTER_DISPLAY_CONFIG_PATH)
            return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(MONSTER_DISPLAY_CONFIG_PATH)})
        except Exception as exc:
            return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/monster-stripe-presets", methods=["GET", "PUT"])
def handle_monster_stripe_presets():
    if request.method == "GET":
        if not os.path.isfile(MONSTER_STRIPE_PRESET_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(MONSTER_STRIPE_PRESET_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500

            errors = validate_monster_stripe_preset_payload(data)
            return jsonify({
                "success": True,
                "count": len(data),
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]
            })
        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500

    elif request.method == "PUT":
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"success": False, "message": "body must be a json object"}), 400

        errors = validate_monster_stripe_preset_payload(payload)
        if errors:
            return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400

        try:
            os.makedirs(os.path.dirname(MONSTER_STRIPE_PRESET_CONFIG_PATH), exist_ok=True)
            with open(f"{MONSTER_STRIPE_PRESET_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{MONSTER_STRIPE_PRESET_CONFIG_PATH}.tmp", MONSTER_STRIPE_PRESET_CONFIG_PATH)
            return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(MONSTER_STRIPE_PRESET_CONFIG_PATH)})
        except Exception as exc:
            return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/pop-number-presets", methods=["GET", "PUT"])
def handle_pop_number_presets():
    if request.method == "GET":
        if not os.path.isfile(POP_NUMBER_PRESET_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(POP_NUMBER_PRESET_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500

            errors = validate_pop_number_preset_payload(data)
            return jsonify({
                "success": True,
                "count": len(data),
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]
            })
        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500

    elif request.method == "PUT":
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"success": False, "message": "body must be a json object"}), 400

        errors = validate_pop_number_preset_payload(payload)
        if errors:
            return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400

        try:
            os.makedirs(os.path.dirname(POP_NUMBER_PRESET_CONFIG_PATH), exist_ok=True)
            with open(f"{POP_NUMBER_PRESET_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{POP_NUMBER_PRESET_CONFIG_PATH}.tmp", POP_NUMBER_PRESET_CONFIG_PATH)
            return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(POP_NUMBER_PRESET_CONFIG_PATH)})
        except Exception as exc:
            return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/burst-capsule-presets", methods=["GET", "PUT"])
def handle_burst_capsule_presets():
    if request.method == "GET":
        if not os.path.isfile(BURST_CAPSULE_PRESET_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(BURST_CAPSULE_PRESET_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500

            errors = validate_burst_capsule_preset_payload(data)
            return jsonify({
                "success": True,
                "count": len(data),
                "data": data,
                "valid": len(errors) == 0,
                "errors": errors[:50]
            })
        except Exception as exc:
            return jsonify({"success": False, "message": f"读取配置失败: {exc}"}), 500

    elif request.method == "PUT":
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"success": False, "message": "body must be a json object"}), 400

        errors = validate_burst_capsule_preset_payload(payload)
        if errors:
            return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400

        try:
            os.makedirs(os.path.dirname(BURST_CAPSULE_PRESET_CONFIG_PATH), exist_ok=True)
            with open(f"{BURST_CAPSULE_PRESET_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{BURST_CAPSULE_PRESET_CONFIG_PATH}.tmp", BURST_CAPSULE_PRESET_CONFIG_PATH)
            return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(BURST_CAPSULE_PRESET_CONFIG_PATH)})
        except Exception as exc:
            return jsonify({"success": False, "message": f"写入配置失败: {exc}"}), 500

@app.route("/api/pick_public_image", methods=["POST"])
def pick_public_image():
    try:
        from tkinter import Tk, filedialog
    except Exception as exc:
        return jsonify({"success": False, "message": f"tkinter unavailable: {exc}"}), 500

    payload = request.get_json(silent=True) or {}
    initial_dir = PUBLIC_DIR
    current_path = str(payload.get("currentPath", "")).strip().replace("\\", "/")
    if current_path:
        cand = os.path.abspath(os.path.join(PUBLIC_DIR, current_path))
        cand_dir = cand if os.path.isdir(cand) else os.path.dirname(cand)
        if os.path.isdir(cand_dir) and is_path_inside(PUBLIC_DIR, cand_dir): initial_dir = cand_dir

    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    selected_path = filedialog.askopenfilename(title=payload.get("title", "选择 public 下图片"), initialdir=initial_dir)
    root.destroy()

    if not selected_path: return jsonify({"success": False, "cancelled": True, "message": "cancelled"}), 200
    selected_abs = os.path.abspath(selected_path)
    
    if not os.path.isfile(selected_abs): return jsonify({"success": False, "message": "file not found"}), 404
    if not is_path_inside(PUBLIC_DIR, selected_abs) or not is_allowed_image_file(selected_abs):
        return jsonify({"success": False, "message": "不合法的文件或路径"}), 403

    p_path = to_public_path(os.path.relpath(selected_abs, PUBLIC_DIR))
    res_path = p_path if p_path.startswith("resources/") else to_resource_path(p_path)
    return jsonify({
        "success": True, "name": os.path.basename(selected_abs), "publicPath": p_path,
        "relativePath": p_path, "resourcePath": res_path, "url": f"/{p_path}", "absolutePath": normalize_slashes(selected_abs),
    })

@app.route("/api/upload_image", methods=["POST"])
def upload_image():
    file = request.files.get("file")
    if not file or not file.filename: return jsonify({"success": False, "message": "missing file"}), 400
    if not is_allowed_image_file(file.filename): return jsonify({"success": False, "message": "Only image files are allowed"}), 403

    subdir = secure_filename(request.form.get("subdir", "skill-assets").strip().strip("/\\")) or "skill-assets"
    target_dir = os.path.join(PUBLIC_RESOURCES_DIR, subdir)
    os.makedirs(target_dir, exist_ok=True)

    stem, ext = os.path.splitext(file.filename)
    final_name = f"{secure_filename(stem) or 'image'}{ext.lower()}"
    full_path = os.path.join(target_dir, final_name)
    file.save(full_path)

    rel_path = normalize_slashes(os.path.relpath(full_path, PUBLIC_RESOURCES_DIR))
    return jsonify({"success": True, "name": final_name, "relativePath": rel_path, "resourcePath": to_resource_path(rel_path), "url": f"/{to_resource_path(rel_path)}"})

@app.route("/api/atlas-json", methods=["PUT"])
def save_atlas_json():
    payload = request.get_json(silent=True) or {}
    raw_path = str(payload.get("path", "")).strip()
    atlas_data = payload.get("data")

    if not raw_path:
        return jsonify({"success": False, "message": "missing path"}), 400
    if not isinstance(atlas_data, dict):
        return jsonify({"success": False, "message": "data must be a json object"}), 400

    normalized = normalize_slashes(raw_path).lstrip("/")
    if not normalized.lower().endswith(".json"):
        normalized = f"{normalized}.json"
    if normalized.startswith("public/"):
        normalized = normalized[len("public/"):]

    abs_target = os.path.abspath(os.path.join(PUBLIC_DIR, normalized))
    if not is_path_inside(PUBLIC_DIR, abs_target):
        return jsonify({"success": False, "message": "path outside public is not allowed"}), 403
    if not abs_target.lower().endswith(".json"):
        return jsonify({"success": False, "message": "only .json is allowed"}), 400

    meta = atlas_data.get("meta")
    if not isinstance(meta, dict):
        return jsonify({"success": False, "message": "atlas data missing meta object"}), 400
    image_value = meta.get("image")
    if not isinstance(image_value, str) or not image_value.strip():
        return jsonify({"success": False, "message": "meta.image is required"}), 400

    try:
        os.makedirs(os.path.dirname(abs_target), exist_ok=True)
        tmp_path = f"{abs_target}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(atlas_data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, abs_target)
        public_path = to_public_path(os.path.relpath(abs_target, PUBLIC_DIR))
        return jsonify({
            "success": True,
            "path": normalize_slashes(abs_target),
            "publicPath": public_path
        })
    except Exception as exc:
        return jsonify({"success": False, "message": f"写入 atlas json 失败: {exc}"}), 500

@app.route("/images/<path:relative_path>", methods=["GET"])
def serve_from_pool(relative_path: str):
    safe_path = os.path.normpath(relative_path).replace("\\", "/")
    if safe_path.startswith("..") or "/.." in safe_path: return "Invalid path", 400
    if not is_allowed_image_file(safe_path): return "Only image files are allowed", 403
    return send_from_directory(IMAGE_DIR, safe_path)

@app.route("/proxy_local_image", methods=["GET"])
def proxy_local_image():
    file_path = os.path.abspath(os.path.normpath(request.args.get("path", "").strip()))
    if not os.path.isfile(file_path): return "File not found", 404
    if not is_allowed_image_file(file_path): return "Only image files are allowed", 403
    return send_from_directory(os.path.dirname(file_path), os.path.basename(file_path), mimetype=mimetypes.guess_type(file_path)[0], max_age=3600)

if __name__ == "__main__":
    def clamp_dev_port(port: int) -> int:
        if port < DEV_PORT_MIN or port > DEV_PORT_MAX:
            return DEV_PORT_MIN
        return port

    def is_port_available(host: str, port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                return False
        return True

    def next_port(port: int) -> int:
        return DEV_PORT_MIN if port >= DEV_PORT_MAX else port + 1

    def resolve_available_port(host: str, start_port: int) -> int | None:
        candidate = clamp_dev_port(start_port)
        for _ in range(DEV_PORT_MAX_ATTEMPTS):
            if is_port_available(host, candidate):
                return candidate
            candidate = next_port(candidate)
        return None

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=DEV_PORT_MIN)
    parser.add_argument("--image-dir", default=IMAGE_DIR)
    args = parser.parse_args()
    
    IMAGE_DIR = os.path.abspath(args.image_dir)
    for d in (IMAGE_DIR, PUBLIC_DIR, PUBLIC_RESOURCES_DIR): os.makedirs(d, exist_ok=True)

    preferred_port = clamp_dev_port(args.port)
    resolved_port = resolve_available_port(args.host, preferred_port)
    if resolved_port is None:
        raise RuntimeError(
            f"无法绑定开发端口：已尝试 {DEV_PORT_MIN}-{DEV_PORT_MAX}（最多 {DEV_PORT_MAX_ATTEMPTS} 次）"
        )

    print(
        "本地图片服务器已启动 -> "
        f"http://{args.host}:{resolved_port} | "
        f"图片池: {IMAGE_DIR} | "
        f"端口扫描范围: {DEV_PORT_MIN}-{DEV_PORT_MAX}"
    )
    app.run(host=args.host, port=resolved_port)
