import { contains, get, hasValue, isRecord, iterable, sameMembers, sizeOf, toSet } from './jsonValues.mjs'

function validateV1Presets(payload) {
  let field
  function require(ok, field) {
    if (!hasValue(ok)) {
      throw new Error(`invalid weapon preset field: ${field}`)
    }
  }
  function obj(value, keys, field) {
    require(isRecord(value) && sameMembers(toSet(value), toSet(keys.split(/\s+/))), field)
  }
  function number(value, field, positive = false) {
    require(typeof value === 'number' && Number.isFinite(value) && (!hasValue(positive) || value > 0), field)
  }
  function vector(value, field, positive = false) {
    obj(value, 'x y z', field)
    for (const axis of 'xyz') {
      number(value[axis], field, positive)
    }
  }
  try {
    require(isRecord(payload), 'library')
    for (const [key, p] of Object.entries(payload)) {
      require(typeof key === 'string' && /^(?:[a-zA-Z0-9_-]+)$(?![\s\S])/.test(key), 'key')
      obj(p, 'version name duration loop playbackSpeed proxy asset keyframes', key)
      require(Number.isInteger(p.version) && p.version === 1, 'version')
      require(typeof p.name === 'string' && typeof p.loop === 'boolean', 'name / loop')
      number(p.duration, 'duration', true)
      number(p.playbackSpeed, 'playbackSpeed', true)
      const proxy = p.proxy
      obj(proxy, 'shape size center grip tip', 'proxy')
      require(['box', 'gun', 'cylinder', 'capsule', 'sphere'].includes(proxy.shape), 'shape')
      for (field of ['size', 'center', 'grip', 'tip']) {
        vector(proxy[field], field, field === 'size')
      }
      const asset = p.asset
      obj(asset, 'path name scale offset rotation', 'asset')
      const path = asset.path
      require(typeof path === 'string', 'asset.path')
      require(!hasValue(path) || /^(?:\/resources\/.+\.(glb|gltf))$(?![\s\S])/i.test(path) && !contains(path, '..') && !contains(path, '\\'), 'asset.path')
      require(typeof asset.name === 'string', 'asset.name')
      number(asset.scale, 'asset.scale', true)
      vector(asset.offset, 'asset.offset')
      vector(asset.rotation, 'asset.rotation')
      const frames = p.keyframes
      require(Array.isArray(frames) && sizeOf(frames) >= 2, 'keyframes')
      const ids = new Set()
      for (const frame of iterable(frames)) {
        obj(frame, 'id time label position rotation', 'keyframe')
        require(typeof frame.id === 'string' && frame.id && !contains(ids, frame.id), 'keyframe.id')
        ids.add(frame.id)
        number(frame.time, 'keyframe.time')
        require(0 <= frame.time && frame.time <= p.duration, 'keyframe.time')
        require(typeof frame.label === 'string', 'keyframe.label')
        vector(frame.position, 'keyframe.position')
        vector(frame.rotation, 'keyframe.rotation')
      }
    }
    return []
  } catch (exc) {
    return [exc.message]
  }
}

function legacyProxyFromV3(proxy) {
  let field
  function require(ok, field) {
    if (!hasValue(ok)) {
      throw new Error(`invalid weapon semantic field: ${field}`)
    }
  }
  function obj(value, keys, field) {
    require(isRecord(value) && sameMembers(toSet(value), toSet(keys.split(/\s+/))), field)
  }
  function vector(value, field, positive = false) {
    obj(value, 'x y z', field)
    for (const axis of 'xyz') {
      const number = value[axis]
      require(typeof number === 'number' && Number.isFinite(number) && (!hasValue(positive) || number > 0), field)
    }
  }
  require(isRecord(proxy) && [toSet('shape size center gripVolume attackVolume muzzle'.split(/\s+/)), toSet('shape size center rotation gripVolume attackVolume muzzle'.split(/\s+/))].some(keys => sameMembers(toSet(proxy), keys)), 'proxy')
  require(['box', 'gun', 'cylinder', 'capsule', 'sphere'].includes(proxy.shape), 'proxy.shape')
  vector(proxy.size, 'proxy.size', true)
  vector(proxy.center, 'proxy.center')
  if (contains(proxy, 'rotation')) {
    vector(proxy.rotation, 'proxy.rotation')
  }
  for (field of ['gripVolume', 'attackVolume']) {
    const volume = proxy[field]
    obj(volume, 'enabled shape center size rotation', field)
    require(typeof volume.enabled === 'boolean' && ['box', 'cylinder', 'capsule', 'sphere'].includes(volume.shape), field)
    vector(volume.center, field + '.center')
    vector(volume.size, field + '.size', true)
    vector(volume.rotation, field + '.rotation')
  }
  const muzzle = proxy.muzzle
  obj(muzzle, 'enabled position rotation', 'muzzle')
  require(typeof muzzle.enabled === 'boolean', 'muzzle.enabled')
  vector(muzzle.position, 'muzzle.position')
  vector(muzzle.rotation, 'muzzle.rotation')
  const tip = hasValue(muzzle.enabled) ? muzzle.position : proxy.attackVolume.center
  return {shape: proxy.shape, size: proxy.size, center: proxy.center, grip: proxy.gripVolume.center, tip: tip}
}

export function validateWeaponPresets(payload) {
  let errors
  let track
  let proxy
  if (!isRecord(payload)) {
    return ['weapon library must be an object']
  }
  for (const [key, project] of Object.entries(payload)) {
    if (!(typeof key === 'string') || !/^(?:[a-zA-Z0-9_-]+)$(?![\s\S])/.test(key)) {
      return ['invalid preset key']
    }
    if (!isRecord(project)) {
      return ['invalid project']
    }
    if (Number.isInteger(get(project, 'version')) && project.version === 1) {
      errors = validateV1Presets({[key]: project})
      if (hasValue(errors)) {
        return errors
      }
      continue
    }
    if (!Number.isInteger(get(project, 'version')) || ![2, 3].includes(project.version) || !sameMembers(toSet(project), new Set(['version', 'name', 'duration', 'loop', 'playbackSpeed', 'weapons']))) {
      return ['invalid v2/v3 project']
    }
    const weapons = project.weapons
    if (!isRecord(weapons) || !sameMembers(toSet(weapons), new Set(['right', 'left']))) {
      return ['v2 requires exactly right and left weapon tracks']
    }
    for (const [hand, trackEntry] of Object.entries(weapons)) {
      track = trackEntry
      if (!isRecord(track) || !sameMembers(toSet(track), new Set(['enabled', 'proxy', 'asset', 'keyframes'])) || !(typeof track.enabled === 'boolean')) {
        return ['invalid weapon track: ' + hand]
      }
      try {
        proxy = project.version === 2 ? track.proxy : legacyProxyFromV3(track.proxy)
      } catch (exc) {
        return [hand + ': ' + exc.message]
      }
      const legacy = Object.fromEntries(['name', 'duration', 'loop', 'playbackSpeed'].map((field) => [field, project[field]]))
      Object.assign(legacy, { version: 1, proxy: proxy, asset: track.asset, keyframes: track.keyframes })
      errors = validateV1Presets({[key]: legacy})
      if (hasValue(errors)) {
        return errors.map((error) => hand + ': ' + error)
      }
    }
    if (!Object.values(weapons).some((track) => hasValue(track.enabled))) {
      return ['at least one weapon track must be enabled']
    }
  }
  return []
}
