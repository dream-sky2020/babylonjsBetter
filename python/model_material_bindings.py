"""Structural parity with core/model/material/modelMaterialBindings.ts."""
import math
import re


def validate_model_material_bindings(value):
    if not isinstance(value, list):
        raise ValueError('materialOverrides must be an array')
    def finite(n):
        return type(n) in (int, float) and math.isfinite(n)
    seen = set()
    for binding in value:
        if not isinstance(binding, dict) or set(binding) - {'selector', 'textures', 'alphaMode', 'alphaCutoff'}:
            raise ValueError('invalid material binding')
        selector = binding.get('selector')
        if not isinstance(selector, dict) or set(selector) != {'gltfMaterialIndex'}:
            raise ValueError('invalid material selector')
        index = selector['gltfMaterialIndex']
        if not finite(index) or index < 0 or int(index) != index or index in seen:
            raise ValueError('invalid or duplicate material index')
        seen.add(index)
        if 'alphaMode' in binding and binding['alphaMode'] not in ('OPAQUE', 'MASK', 'BLEND'):
            raise ValueError('invalid alphaMode')
        if 'alphaCutoff' in binding and (not finite(binding['alphaCutoff']) or not 0 <= binding['alphaCutoff'] <= 1):
            raise ValueError('invalid alphaCutoff')
        textures = binding.get('textures', {})
        if not isinstance(textures, dict) or set(textures) - {'baseColor', 'normal', 'metallicRoughness', 'occlusion', 'emissive'}:
            raise ValueError('invalid texture slots')
        for texture in textures.values():
            if texture is None:
                continue
            if not isinstance(texture, dict) or set(texture) - {'path', 'uvSet', 'offset', 'scale', 'rotation', 'wrapU', 'wrapV', 'samplingMode', 'noMipmap', 'level'}:
                raise ValueError('invalid texture binding')
            path = texture.get('path')
            if not isinstance(path, str) or not re.fullmatch(r'/?resources/.+\.(png|jpe?g|webp)', path, re.I) or re.search(r'[\\%?#]|(?:^|/)\.\.(?:/|$)', path):
                raise ValueError('invalid texture path')
            for key, low, high in [('uvSet', 0, 5), ('wrapU', 0, 2), ('wrapV', 0, 2), ('samplingMode', 1, 12)]:
                if key in texture and (not finite(texture[key]) or int(texture[key]) != texture[key] or not low <= texture[key] <= high):
                    raise ValueError('invalid ' + key)
            for key in ('offset', 'scale'):
                if key in texture and (not isinstance(texture[key], list) or len(texture[key]) != 2 or not all(finite(n) for n in texture[key])):
                    raise ValueError('invalid ' + key)
            for key in ('rotation', 'level'):
                if key in texture and not finite(texture[key]):
                    raise ValueError('invalid ' + key)
            if 'noMipmap' in texture and type(texture['noMipmap']) is not bool:
                raise ValueError('invalid noMipmap')
