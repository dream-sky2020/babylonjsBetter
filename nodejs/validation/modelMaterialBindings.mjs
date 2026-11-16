import { contains, get, hasOtherMembers, hasValue, isRecord, iterable, sameMembers, sizeOf, toSet } from './jsonValues.mjs'

export function validateModelMaterialBindings(value) {
  if (!Array.isArray(value)) {
    throw new Error('materialOverrides must be an array')
  }
  function finite(n) {
    return typeof n === 'number' && Number.isFinite(n)
  }
  const seen = new Set()
  for (const binding of iterable(value)) {
    if (!isRecord(binding) || hasOtherMembers(toSet(binding), new Set(['selector', 'textures', 'alphaMode', 'alphaCutoff']))) {
      throw new Error('invalid material binding')
    }
    const selector = get(binding, 'selector')
    if (!isRecord(selector) || !sameMembers(toSet(selector), new Set(['gltfMaterialIndex']))) {
      throw new Error('invalid material selector')
    }
    const index = selector.gltfMaterialIndex
    if (!hasValue(finite(index)) || index < 0 || Math.trunc(index) !== index || contains(seen, index)) {
      throw new Error('invalid or duplicate material index')
    }
    seen.add(index)
    if (contains(binding, 'alphaMode') && !['OPAQUE', 'MASK', 'BLEND'].includes(binding.alphaMode)) {
      throw new Error('invalid alphaMode')
    }
    if (contains(binding, 'alphaCutoff') && (!hasValue(finite(binding.alphaCutoff)) || (0 > binding.alphaCutoff || binding.alphaCutoff > 1))) {
      throw new Error('invalid alphaCutoff')
    }
    const textures = get(binding, 'textures', {})
    if (!isRecord(textures) || hasOtherMembers(toSet(textures), new Set(['baseColor', 'normal', 'metallicRoughness', 'occlusion', 'emissive']))) {
      throw new Error('invalid texture slots')
    }
    for (const texture of Object.values(textures)) {
      if (texture === null) {
        continue
      }
      if (!isRecord(texture) || hasOtherMembers(toSet(texture), new Set(['path', 'uvSet', 'offset', 'scale', 'rotation', 'wrapU', 'wrapV', 'samplingMode', 'noMipmap', 'level']))) {
        throw new Error('invalid texture binding')
      }
      const path = get(texture, 'path')
      if (!(typeof path === 'string') || !/^(?:\/?resources\/.+\.(png|jpe?g|webp))$(?![\s\S])/i.test(path) || /[\\%?#]|(?:^|\/)\.\.(?:\/|$)/.test(path)) {
        throw new Error('invalid texture path')
      }
      for (const [key, low, high] of [['uvSet', 0, 5], ['wrapU', 0, 2], ['wrapV', 0, 2], ['samplingMode', 1, 12]]) {
        if (contains(texture, key) && (!hasValue(finite(texture[key])) || Math.trunc(texture[key]) !== texture[key] || (low > texture[key] || texture[key] > high))) {
          throw new Error('invalid ' + key)
        }
      }
      for (const key of ['offset', 'scale']) {
        if (contains(texture, key) && (!Array.isArray(texture[key]) || sizeOf(texture[key]) !== 2 || !texture[key].every((n) => hasValue(finite(n))))) {
          throw new Error('invalid ' + key)
        }
      }
      for (const key of ['rotation', 'level']) {
        if (contains(texture, key) && !hasValue(finite(texture[key]))) {
          throw new Error('invalid ' + key)
        }
      }
      if (contains(texture, 'noMipmap') && !(typeof texture.noMipmap === 'boolean')) {
        throw new Error('invalid noMipmap')
      }
    }
  }
}
