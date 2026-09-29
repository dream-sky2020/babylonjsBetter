"""Read-only split scene catalog; no fallback to the retired monolithic file."""
import json
import os
import re


def read_scene_environment_presets(directory):
    root = os.path.realpath(directory)

    def read(file_name):
        target = os.path.join(root, file_name)
        if os.path.islink(target) or os.path.dirname(os.path.realpath(target)) != root:
            raise ValueError("scene catalog cannot reference files outside its directory")
        with open(target, encoding="utf-8") as file:
            return json.load(file)

    index = read("index.json")
    if not isinstance(index, dict) or index.get("version") != 1 or not isinstance(index.get("presets"), dict):
        raise ValueError("invalid scene catalog")
    result = {}
    names = set()
    for key, file_name in index["presets"].items():
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}", key) or re.fullmatch(r"con|prn|aux|nul|com[0-9]|lpt[0-9]|index", key, re.I):
            raise ValueError("invalid scene preset key")
        if file_name != key + ".json" or file_name.lower() in names:
            raise ValueError("invalid or duplicate scene filename")
        names.add(file_name.lower())
        value = read(file_name)
        if not isinstance(value, dict) or value.get("presetKey") != key:
            raise ValueError("scene presetKey must match catalog key")
        result[key] = value
    resolved = set()

    def visit(key, pending):
        if key in resolved:
            return
        if key not in result or key in pending:
            raise ValueError("missing base scene or cyclic inheritance")
        base = result[key].get("extendsPresetKey")
        if base is not None:
            if not isinstance(base, str):
                raise ValueError("invalid extendsPresetKey")
            visit(base, pending | {key})
        resolved.add(key)

    for key in result:
        visit(key, set())
    return result
