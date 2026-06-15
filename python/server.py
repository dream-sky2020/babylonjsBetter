import argparse
import mimetypes
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_IMAGE_DIR = os.path.join(PROJECT_DIR, "Identity_Skill_Icons")
IMAGE_DIR = DEFAULT_IMAGE_DIR


def normalize_slashes(path: str) -> str:
    return path.replace("\\", "/")


def is_allowed_image_file(path: str) -> bool:
    _, ext = os.path.splitext(path.lower())
    return ext in ALLOWED_IMAGE_EXTENSIONS


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "imageDir": normalize_slashes(IMAGE_DIR)})


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
                }
            )
    result.sort(key=lambda item: item["relativePath"])
    return jsonify({"success": True, "count": len(result), "items": result})


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

    print("--------------------------------------")
    print("本地图片 API Server 已启动")
    print(f"监听地址: http://{args.host}:{args.port}")
    print(f"图片目录: {IMAGE_DIR}")
    print("接口示例:")
    print(f"- 健康检查: http://{args.host}:{args.port}/health")
    print(f"- 列表接口: http://{args.host}:{args.port}/api/images")
    print(f"- 目录图片: http://{args.host}:{args.port}/images/<relativePath>")
    print(f"- 代理本地: http://{args.host}:{args.port}/proxy_local_image?path=D:/xx/a.png")
    print("--------------------------------------")

    app.run(host=args.host, port=args.port)
