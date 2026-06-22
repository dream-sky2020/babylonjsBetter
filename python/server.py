import argparse
import mimetypes
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(PROJECT_DIR, ".."))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
PUBLIC_RESOURCES_DIR = os.path.join(PUBLIC_DIR, "resources")
DEFAULT_IMAGE_DIR = os.path.join(PROJECT_DIR, "Identity_Skill_Icons")
IMAGE_DIR = DEFAULT_IMAGE_DIR


def normalize_slashes(path: str) -> str:
    return path.replace("\\", "/")


def to_resource_path(rel_path: str) -> str:
    normalized = normalize_slashes(rel_path).lstrip("/")
    return f"resources/{normalized}"


def to_public_path(rel_path: str) -> str:
    return normalize_slashes(rel_path).lstrip("/")


def is_path_inside(base_dir: str, target_path: str) -> bool:
    base_abs = os.path.abspath(base_dir)
    target_abs = os.path.abspath(target_path)
    try:
        return os.path.commonpath([base_abs, target_abs]) == base_abs
    except ValueError:
        return False


def is_allowed_image_file(path: str) -> bool:
    _, ext = os.path.splitext(path.lower())
    return ext in ALLOWED_IMAGE_EXTENSIONS


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "ok": True,
            "imageDir": normalize_slashes(IMAGE_DIR),
            "publicDir": normalize_slashes(PUBLIC_DIR),
        }
    )


@app.route("/resources/<path:relative_path>", methods=["GET"])
def serve_public_resource(relative_path: str):
    safe_path = os.path.normpath(relative_path).replace("\\", "/")
    if safe_path.startswith("..") or "/.." in safe_path:
        return "Invalid path", 400
    if not is_allowed_image_file(safe_path):
        return "Only image files are allowed", 403
    return send_from_directory(PUBLIC_RESOURCES_DIR, safe_path)


@app.route("/api/images", methods=["GET"])
def list_images():
    if not os.path.isdir(IMAGE_DIR):
        return jsonify({"success": False, "message": f"目录不存在: {IMAGE_DIR}"}), 404

    result = []
    for root, _, files in os.walk(IMAGE_DIR):
        for file_name in files:
            full_path = os.path.join(root, file_name)
            if not is_allowed_image_file(full_path):
                continue
            rel_path = normalize_slashes(os.path.relpath(full_path, IMAGE_DIR))
            result.append(
                {
                    "name": file_name,
                    "relativePath": rel_path,
                    "url": f"/images/{rel_path}",
                    "absolutePath": normalize_slashes(os.path.abspath(full_path))
                }
            )
    result.sort(key=lambda item: item["relativePath"])
    return jsonify({"success": True, "count": len(result), "items": result})


@app.route("/api/find_resource_by_name", methods=["GET"])
def find_resource_by_name():
    file_name = request.args.get("name", "").strip()
    if not file_name:
        return jsonify({"success": False, "message": "missing name"}), 400
    if not is_allowed_image_file(file_name):
        return jsonify({"success": False, "message": "Only image files are allowed"}), 403

    normalized_name = file_name.lower()
    if os.path.isdir(PUBLIC_DIR):
        for root, _, files in os.walk(PUBLIC_DIR):
            for current_name in files:
                if current_name.lower() != normalized_name:
                    continue
                full_path = os.path.join(root, current_name)
                public_rel_path = to_public_path(os.path.relpath(full_path, PUBLIC_DIR))
                resource_path = (
                    public_rel_path
                    if public_rel_path.startswith("resources/")
                    else to_resource_path(public_rel_path)
                )
                return jsonify(
                    {
                        "success": True,
                        "name": current_name,
                        "relativePath": public_rel_path,
                        "publicPath": public_rel_path,
                        "resourcePath": resource_path,
                        "url": f"/{public_rel_path}",
                        "absolutePath": normalize_slashes(os.path.abspath(full_path))
                    }
                )

    return jsonify({"success": False, "message": "not found"}), 404


@app.route("/api/pick_public_image", methods=["POST"])
def pick_public_image():
    try:
        from tkinter import Tk, filedialog
    except Exception as exc:
        return jsonify({"success": False, "message": f"tkinter unavailable: {exc}"}), 500

    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip() or "选择 public 下图片"
    current_path = str(payload.get("currentPath", "")).strip().replace("\\", "/")

    initial_dir = PUBLIC_DIR
    if current_path:
        candidate = os.path.abspath(os.path.join(PUBLIC_DIR, current_path))
        candidate_dir = candidate if os.path.isdir(candidate) else os.path.dirname(candidate)
        if os.path.isdir(candidate_dir) and is_path_inside(PUBLIC_DIR, candidate_dir):
            initial_dir = candidate_dir

    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    selected_path = filedialog.askopenfilename(
        title=title,
        initialdir=initial_dir,
        filetypes=[("Image Files", "*.png *.jpg *.jpeg *.gif *.webp *.bmp *.svg"), ("All Files", "*.*")],
    )
    root.destroy()

    if not selected_path:
        return jsonify({"success": False, "cancelled": True, "message": "cancelled"}), 200

    selected_abs = os.path.abspath(selected_path)
    if not os.path.isfile(selected_abs):
        return jsonify({"success": False, "message": "file not found"}), 404
    if not is_path_inside(PUBLIC_DIR, selected_abs):
        return jsonify({"success": False, "message": "只能选择 public 目录内的文件"}), 403
    if not is_allowed_image_file(selected_abs):
        return jsonify({"success": False, "message": "Only image files are allowed"}), 403

    public_path = to_public_path(os.path.relpath(selected_abs, PUBLIC_DIR))
    resource_path = public_path if public_path.startswith("resources/") else to_resource_path(public_path)
    return jsonify(
        {
            "success": True,
            "name": os.path.basename(selected_abs),
            "publicPath": public_path,
            "relativePath": public_path,
            "resourcePath": resource_path,
            "url": f"/{public_path}",
            "absolutePath": normalize_slashes(selected_abs),
        }
    )


@app.route("/api/upload_image", methods=["POST"])
def upload_image():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "missing file"}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"success": False, "message": "empty file"}), 400
    if not is_allowed_image_file(file.filename):
        return jsonify({"success": False, "message": "Only image files are allowed"}), 403

    subdir = request.form.get("subdir", "skill-assets").strip().strip("/\\")
    safe_subdir = secure_filename(subdir) or "skill-assets"
    target_dir = os.path.join(PUBLIC_RESOURCES_DIR, safe_subdir)
    os.makedirs(target_dir, exist_ok=True)

    stem, ext = os.path.splitext(file.filename)
    safe_stem = secure_filename(stem) or "image"
    safe_ext = ext.lower() if ext else ""
    final_name = f"{safe_stem}{safe_ext}"
    full_path = os.path.join(target_dir, final_name)
    file.save(full_path)

    rel_path = normalize_slashes(os.path.relpath(full_path, PUBLIC_RESOURCES_DIR))
    resource_path = to_resource_path(rel_path)
    return jsonify(
        {
            "success": True,
            "name": final_name,
            "relativePath": rel_path,
            "resourcePath": resource_path,
            "url": f"/{resource_path}",
        }
    )


@app.route("/images/<path:relative_path>", methods=["GET"])
def serve_from_pool(relative_path: str):
    safe_path = os.path.normpath(relative_path).replace("\\", "/")
    if safe_path.startswith("..") or "/.." in safe_path:
        return "Invalid path", 400
    if not is_allowed_image_file(safe_path):
        return "Only image files are allowed", 403
    return send_from_directory(IMAGE_DIR, safe_path)


@app.route("/proxy_local_image", methods=["GET"])
def proxy_local_image():
    file_path = request.args.get("path", "").strip()
    if not file_path:
        return "Missing path", 400

    file_path = os.path.abspath(os.path.normpath(file_path))
    if not os.path.isfile(file_path):
        return f"File not found: {file_path}", 404
    if not is_allowed_image_file(file_path):
        return "Only image files are allowed", 403

    directory = os.path.dirname(file_path)
    filename = os.path.basename(file_path)
    mime_type = mimetypes.guess_type(file_path)[0]
    return send_from_directory(directory, filename, mimetype=mime_type, max_age=3600)


def parse_args():
    parser = argparse.ArgumentParser(description="本地图片服务（供前端通过 URL 加载）")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
    parser.add_argument("--port", type=int, default=5050, help="监听端口，默认 5050")
    parser.add_argument(
        "--image-dir",
        default=DEFAULT_IMAGE_DIR,
        help="技能池图片目录，默认 python/Identity_Skill_Icons",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    IMAGE_DIR = os.path.abspath(args.image_dir)
    os.makedirs(IMAGE_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(PUBLIC_RESOURCES_DIR, exist_ok=True)

    print("--------------------------------------")
    print("本地图片 API Server 已启动")
    print(f"监听地址: http://{args.host}:{args.port}")
    print(f"图片目录: {IMAGE_DIR}")
    print(f"公共资源目录: {PUBLIC_DIR}")
    print("接口示例:")
    print(f"- 健康检查: http://{args.host}:{args.port}/health")
    print(f"- 列表接口: http://{args.host}:{args.port}/api/images")
    print(f"- 目录图片: http://{args.host}:{args.port}/images/<relativePath>")
    print(f"- 公共资源: http://{args.host}:{args.port}/resources/<relativePath>")
    print(f"- 上传图片: POST http://{args.host}:{args.port}/api/upload_image")
    print(f"- 按名搜索: http://{args.host}:{args.port}/api/find_resource_by_name?name=xxx.png")
    print(f"- 选择图片: POST http://{args.host}:{args.port}/api/pick_public_image")
    print(f"- 代理本地: http://{args.host}:{args.port}/proxy_local_image?path=D:/xx/a.png")
    print("--------------------------------------")

    app.run(host=args.host, port=args.port)
