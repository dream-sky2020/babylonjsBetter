# server.py
import argparse
import mimetypes
import os
import json
import socket
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# 导入抽离出去的工具和计算逻辑
from utils import (
    normalize_slashes, to_resource_path, to_public_path, is_path_inside,
    is_allowed_image_file, validate_sprite_anchor_payload, validate_particle_preset_payload,
    validate_sprite_animation_payload
)

app = Flask(__name__)
CORS(app)

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(PROJECT_DIR, ".."))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
PUBLIC_RESOURCES_DIR = os.path.join(PUBLIC_DIR, "resources")
SPRITE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "spriteAnchorPresets.json")
SPRITE_ANIMATION_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "spriteAnimationLibrary.json")
PARTICLE_PRESET_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "particlePresets.json")
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

@app.route("/api/particle-presets", methods=["GET", "PUT"])
def handle_particle_presets():
    if request.method == "GET":
        if not os.path.isfile(PARTICLE_PRESET_CONFIG_PATH):
            return jsonify({"success": True, "count": 0, "data": {}})
        try:
            with open(PARTICLE_PRESET_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                return jsonify({"success": False, "message": "配置文件根节点必须是 JSON 对象", "valid": False}), 500

            errors = validate_particle_preset_payload(data)
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

        errors = validate_particle_preset_payload(payload)
        if errors:
            return jsonify({"success": False, "message": "配置校验失败", "errorCount": len(errors), "errors": errors[:50]}), 400

        try:
            os.makedirs(os.path.dirname(PARTICLE_PRESET_CONFIG_PATH), exist_ok=True)
            with open(f"{PARTICLE_PRESET_CONFIG_PATH}.tmp", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(f"{PARTICLE_PRESET_CONFIG_PATH}.tmp", PARTICLE_PRESET_CONFIG_PATH)
            return jsonify({"success": True, "count": len(payload), "path": normalize_slashes(PARTICLE_PRESET_CONFIG_PATH)})
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