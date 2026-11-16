import { validateModelMaterialBindings } from './modelMaterialBindings.mjs'
import { validateMapInteractions } from './interactionSchema.mjs'
import { contains, enumerate, get, hasValue, isRecord, iterable, sizeOf, splitOnce } from './jsonValues.mjs'

const [ANCHOR_MIN, ANCHOR_MAX] = [-1, 2]

const [BOUNDS_MIN, BOUNDS_MAX] = [0, 1]

const [COLOR_MIN, COLOR_MAX] = [0, 1]

export function isFiniteNumber(value) {
  return (typeof value === 'number' || typeof value === 'boolean') && !(typeof value === 'boolean') && Number.isFinite(value)
}

export function validateDungeonMapPresetPayload(payload) {
  let width
  let height
  let expectedTiles
  let value
  let definitions
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  const validTopologies = new Set(['bounded', 'loop-horizontal', 'loop-vertical', 'loop'])
  for (const [key, preset] of Object.entries(payload)) {
    const path = `presets.${key}`
    if (!isRecord(preset)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if ([2, 3].includes(get(preset, 'schemaVersion'))) {
      const identity = get(preset, 'identity')
      const grid = get(preset, 'grid')
      const entities = get(preset, 'entities')
      const components = get(preset, 'components')
      const terrain = get(preset, 'terrain')
      if (!isRecord(identity)) {
        errors.push(`${path}.identity must be an object`)
        continue
      }
      if (get(identity, 'presetKey') !== key) {
        errors.push(`${path}.identity.presetKey must match its object key`)
      }
      if (!(typeof get(identity, 'id') === 'string') || !get(identity, 'id', '').trim()) {
        errors.push(`${path}.identity.id must be a non-empty string`)
      }
      if (!(typeof get(identity, 'name') === 'string') || !get(identity, 'name', '').trim()) {
        errors.push(`${path}.identity.name must be a non-empty string`)
      }
      if (!isRecord(grid)) {
        errors.push(`${path}.grid must be an object`)
        continue
      }
      ;[width, height] = [get(grid, 'width'), get(grid, 'height')]
      if (!Number.isInteger(width) || typeof width === 'boolean' || width < 1) {
        errors.push(`${path}.grid.width must be a positive integer`)
      }
      if (!Number.isInteger(height) || typeof height === 'boolean' || height < 1) {
        errors.push(`${path}.grid.height must be a positive integer`)
      }
      if (!contains(validTopologies, get(grid, 'topologyMode', 'bounded'))) {
        errors.push(`${path}.grid.topologyMode is invalid`)
      }
      if (terrain !== null) {
        if (!isRecord(terrain)) {
          errors.push(`${path}.terrain must be an object`)
        } else if (!isRecord(get(terrain, 'default'))) {
          errors.push(`${path}.terrain.default must be an object`)
        } else if (contains(terrain, 'overrides') && !isRecord(get(terrain, 'overrides'))) {
          errors.push(`${path}.terrain.overrides must be an object`)
        }
      }
      errors.push(...validateMapInteractions(preset, path))
      if (get(preset, 'schemaVersion') === 3) {
        const forbiddenFields = ['tileIds', 'tileSides', 'sides', 'edges', 'tilePoints', 'points']
        for (const field of iterable(forbiddenFields)) {
          if (contains(grid, field)) {
            errors.push(`${path}.grid.${field} must be omitted in compact V3`)
          }
        }
        if (!Array.isArray(entities)) {
          errors.push(`${path}.entities must be an array`)
        }
        if (!isRecord(components)) {
          errors.push(`${path}.components must be an object`)
        } else if (Object.values(components).some((table) => !Array.isArray(table))) {
          errors.push(`${path}.components values must be arrays`)
        }
        continue
      }
      expectedTiles = Number.isInteger(width) && Number.isInteger(height) ? width * height : null
      const tileSides = get(grid, 'tileSides')
      const tilePoints = get(grid, 'tilePoints')
      for (const field of ['tileIds', 'tileSides', 'tilePoints']) {
        value = get(grid, field)
        if (!Array.isArray(value)) {
          errors.push(`${path}.grid.${field} must be an array`)
        } else if (expectedTiles !== null && sizeOf(value) !== expectedTiles) {
          errors.push(`${path}.grid.${field} length must equal width * height`)
        }
      }
      if (Array.isArray(tileSides) && tileSides.some((item) => !Array.isArray(item) || sizeOf(item) !== 4)) {
        errors.push(`${path}.grid.tileSides entries must contain north, east, south and west`)
      }
      if (Array.isArray(tilePoints) && tilePoints.some((item) => !Array.isArray(item) || sizeOf(item) !== 4)) {
        errors.push(`${path}.grid.tilePoints entries must contain four corners`)
      }
      for (const field of ['sides', 'edges', 'points']) {
        if (!Array.isArray(get(grid, field))) {
          errors.push(`${path}.grid.${field} must be an array`)
        }
      }
      if (!Array.isArray(entities)) {
        errors.push(`${path}.entities must be an array`)
      }
      if (!isRecord(components)) {
        errors.push(`${path}.components must be an object`)
      } else if (Object.values(components).some((table) => !Array.isArray(table))) {
        errors.push(`${path}.components values must be arrays`)
      }
      continue
    }
    if (get(preset, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(preset, 'name') === 'string') || !get(preset, 'name', '').trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const mapData = get(preset, 'map')
    if (!isRecord(mapData)) {
      errors.push(`${path}.map must be an object`)
      continue
    }
    if (!(typeof get(mapData, 'id') === 'string') || !get(mapData, 'id', '').trim()) {
      errors.push(`${path}.map.id must be a non-empty string`)
    }
    ;[width, height] = [get(mapData, 'width'), get(mapData, 'height')]
    if (!Number.isInteger(width) || typeof width === 'boolean' || width < 1) {
      errors.push(`${path}.map.width must be a positive integer`)
    }
    if (!Number.isInteger(height) || typeof height === 'boolean' || height < 1) {
      errors.push(`${path}.map.height must be a positive integer`)
    }
    if (!contains(validTopologies, get(mapData, 'topologyMode', 'bounded'))) {
      errors.push(`${path}.map.topologyMode is invalid`)
    }
    if (get(mapData, 'format') === 'definition-refs') {
      if (get(mapData, 'version') !== 1) {
        errors.push(`${path}.map.version must be 1`)
      }
      definitions = get(mapData, 'dataDefinitions')
      if (!Array.isArray(definitions)) {
        errors.push(`${path}.map.dataDefinitions must be an array`)
        definitions = []
      }
      const definitionCount = sizeOf(definitions)
      function validRef(value) {
        return Number.isInteger(value) && !(typeof value === 'boolean') && (-1 <= value && value < definitionCount)
      }
      if (!hasValue(validRef(get(mapData, 'mapDataDefinitionRef')))) {
        errors.push(`${path}.map.mapDataDefinitionRef is invalid`)
      }
      const tileRefs = get(mapData, 'tileDataDefinitionRefs')
      expectedTiles = Number.isInteger(width) && Number.isInteger(height) ? width * height : null
      if (!Array.isArray(tileRefs) || expectedTiles !== null && sizeOf(tileRefs) !== expectedTiles) {
        errors.push(`${path}.map.tileDataDefinitionRefs length must equal width * height`)
      } else if (tileRefs.some((value) => !hasValue(validRef(value)))) {
        errors.push(`${path}.map.tileDataDefinitionRefs contains an invalid reference`)
      }
      const edgeLayers = get(mapData, 'tileEdgeDataDefinitionRefs')
      if (!Array.isArray(edgeLayers) || sizeOf(edgeLayers) !== 4) {
        errors.push(`${path}.map.tileEdgeDataDefinitionRefs must contain east, south, west and north arrays`)
      } else {
        for (const [directionIndex, layer] of enumerate(edgeLayers)) {
          if (!Array.isArray(layer) || expectedTiles !== null && sizeOf(layer) !== expectedTiles) {
            errors.push(`${path}.map.tileEdgeDataDefinitionRefs[${directionIndex}] length must equal width * height`)
          } else if (layer.some((value) => !hasValue(validRef(value)))) {
            errors.push(`${path}.map.tileEdgeDataDefinitionRefs[${directionIndex}] contains an invalid reference`)
          }
        }
      }
      if (!Array.isArray(get(mapData, 'sharedEdges'))) {
        errors.push(`${path}.map.sharedEdges must be an array`)
      }
      if (!Array.isArray(get(mapData, 'sharedPoints'))) {
        errors.push(`${path}.map.sharedPoints must be an array`)
      }
      continue
    }
    const tiles = get(mapData, 'tiles')
    if (!Array.isArray(tiles)) {
      errors.push(`${path}.map.tiles must be an array`)
    } else if (Number.isInteger(width) && Number.isInteger(height) && sizeOf(tiles) !== width * height) {
      errors.push(`${path}.map.tiles length must equal width * height`)
    }
    if (contains(mapData, 'sharedEdges') && !Array.isArray(get(mapData, 'sharedEdges'))) {
      errors.push(`${path}.map.sharedEdges must be an array`)
    }
    if (contains(mapData, 'sharedPoints') && !Array.isArray(get(mapData, 'sharedPoints'))) {
      errors.push(`${path}.map.sharedPoints must be an array`)
    }
  }
  return errors
}

function reqStr(obj, field, errs, path, allowEmpty = false) {
  const v = get(obj, field)
  if (!(typeof v === 'string')) {
    errs.push(`${path}.${field} 必须是字符串`)
    return ''
  }
  if (!hasValue(allowEmpty) && !v.trim()) {
    errs.push(`${path}.${field} 不能为空`)
  }
  return v
}

function reqNum(obj, field, errs, path, cMin = null, cMax = null) {
  const v = get(obj, field)
  if (!hasValue(isFiniteNumber(v))) {
    errs.push(`${path}.${field} 必须是有限数字`)
    return 0
  }
  const num = Number(v)
  if (cMin !== null && num < cMin) {
    errs.push(`${path}.${field} 不能小于 ${cMin}`)
  }
  if (cMax !== null && num > cMax) {
    errs.push(`${path}.${field} 不能大于 ${cMax}`)
  }
  return num
}

function reqObj(obj, field, errs, path) {
  const v = get(obj, field)
  if (!isRecord(v)) {
    errs.push(`${path}.${field} 必须是对象`)
    return {}
  }
  return v
}

export function validateNumberSpriteConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, preset] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('preset key must be a non-empty string')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(preset, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(preset, 'name') === 'string') || !preset.name.trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const height = get(preset, 'height')
    const spacing = get(preset, 'spacing')
    if (!hasValue(isFiniteNumber(height)) || height <= 0 || height > 1000) {
      errors.push(`${path}.height must be between 0 and 1000`)
    }
    if (!hasValue(isFiniteNumber(spacing)) || spacing < -100 || spacing > 100) {
      errors.push(`${path}.spacing must be between -100 and 100`)
    }
    if (!(typeof get(preset, 'groupingEnabled') === 'boolean')) {
      errors.push(`${path}.groupingEnabled must be a boolean`)
    }
    const groupingExtraSpacing = get(preset, 'groupingExtraSpacing')
    if (!hasValue(isFiniteNumber(groupingExtraSpacing)) || groupingExtraSpacing < 0 || groupingExtraSpacing > 100) {
      errors.push(`${path}.groupingExtraSpacing must be between 0 and 100`)
    }
    if (!['left', 'center', 'right'].includes(get(preset, 'alignment'))) {
      errors.push(`${path}.alignment must be left, center or right`)
    }
    if (!(typeof get(preset, 'billboard') === 'boolean')) {
      errors.push(`${path}.billboard must be a boolean`)
    }
    const glyphs = get(preset, 'glyphs')
    if (!isRecord(glyphs)) {
      errors.push(`${path}.glyphs must be an object`)
      continue
    }
    for (const [glyph, source] of Object.entries(glyphs)) {
      const glyphPath = `${path}.glyphs[${glyph}]`
      if (!(typeof glyph === 'string') || sizeOf(glyph) !== 1) {
        errors.push(`${glyphPath} key must be one character`)
      }
      if (!isRecord(source)) {
        errors.push(`${glyphPath} must be an object`)
        continue
      }
      const sourceType = get(source, 'type')
      if (sourceType === 'single') {
        if (!(typeof get(source, 'imagePath') === 'string') || !source.imagePath.trim()) {
          errors.push(`${glyphPath}.imagePath must be a non-empty string`)
        }
      } else if (sourceType === 'atlas') {
        if (!(typeof get(source, 'atlasJsonPath') === 'string') || !source.atlasJsonPath.trim()) {
          errors.push(`${glyphPath}.atlasJsonPath must be a non-empty string`)
        }
        if (!(typeof get(source, 'frameName') === 'string') || !source.frameName.trim()) {
          errors.push(`${glyphPath}.frameName must be a non-empty string`)
        }
      } else {
        errors.push(`${glyphPath}.type must be single or atlas`)
      }
    }
  }
  return errors
}

export function validateSpriteAnchorPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('root 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const pKey = reqStr(preset, 'presetKey', errors, pPath)
    const imgP = reqStr(preset, 'imagePath', errors, pPath)
    if (get(preset, 'frameName') !== null && !(typeof get(preset, 'frameName') === 'string')) {
      errors.push(`${pPath}.frameName 必须是字符串或 null`)
    }
    if (hasValue(pKey) && key !== pKey) {
      errors.push(`${pPath}.presetKey 必须与对象 key 一致`)
    }
    if (hasValue(imgP) && !imgP.trim()) {
      errors.push(`${pPath}.imagePath 不能为空`)
    }
    const bb = reqObj(preset, 'bodyBounds', errors, pPath)
    const minU = reqNum(bb, 'minU', errors, `${pPath}.bodyBounds`, BOUNDS_MIN, BOUNDS_MAX)
    const maxU = reqNum(bb, 'maxU', errors, `${pPath}.bodyBounds`, BOUNDS_MIN, BOUNDS_MAX)
    const minV = reqNum(bb, 'minV', errors, `${pPath}.bodyBounds`, BOUNDS_MIN, BOUNDS_MAX)
    const maxV = reqNum(bb, 'maxV', errors, `${pPath}.bodyBounds`, BOUNDS_MIN, BOUNDS_MAX)
    if (minU > maxU) {
      errors.push(`${pPath}.bodyBounds.minU 不能大于 maxU`)
    }
    if (minV > maxV) {
      errors.push(`${pPath}.bodyBounds.minV 不能大于 maxV`)
    }
    reqNum(preset, 'bodyAxisX', errors, pPath, ANCHOR_MIN, ANCHOR_MAX)
    const anchors = reqObj(preset, 'anchors', errors, pPath)
    for (const name of ['head', 'foot', 'center']) {
      const aObj = get(anchors, name)
      if (!isRecord(aObj)) {
        errors.push(`${pPath}.anchors.${name} 必须是对象`)
        continue
      }
      reqNum(aObj, 'u', errors, `${pPath}.anchors.${name}`, ANCHOR_MIN, ANCHOR_MAX)
      reqNum(aObj, 'v', errors, `${pPath}.anchors.${name}`, ANCHOR_MIN, ANCHOR_MAX)
    }
    const af = get(preset, 'atlasFrame')
    if (af === null) {
      continue
    }
    if (!isRecord(af)) {
      errors.push(`${pPath}.atlasFrame 必须是对象或 null`)
      continue
    }
    reqStr(af, 'atlasPath', errors, `${pPath}.atlasFrame`)
    reqStr(af, 'frameName', errors, `${pPath}.atlasFrame`)
    if (!(typeof get(af, 'rotated') === 'boolean')) {
      errors.push(`${pPath}.atlasFrame.rotated 必须是布尔值`)
    }
    if (!(typeof get(af, 'trimmed') === 'boolean')) {
      errors.push(`${pPath}.atlasFrame.trimmed 必须是布尔值`)
    }
    for (const boxName of ['frame', 'spriteSourceSize']) {
      const box = reqObj(af, boxName, errors, `${pPath}.atlasFrame`)
      for (const fld of ['x', 'y']) {
        reqNum(box, fld, errors, `${pPath}.atlasFrame.${boxName}`, 0)
      }
      for (const fld of ['w', 'h']) {
        reqNum(box, fld, errors, `${pPath}.atlasFrame.${boxName}`, 1)
      }
    }
    for (const sizeName of ['sourceSize', 'atlasSize']) {
      const sz = reqObj(af, sizeName, errors, `${pPath}.atlasFrame`)
      for (const fld of ['w', 'h']) {
        reqNum(sz, fld, errors, `${pPath}.atlasFrame.${sizeName}`, 1)
      }
    }
  }
  return errors
}

export function validateParticleEffectPayload(payload) {
  let axis
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, effect] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!isRecord(effect)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(effect, 'effectKey') !== key) {
      errors.push(`${path}.effectKey must match its object key`)
    }
    if (!(typeof get(effect, 'name') === 'string') || !get(effect, 'name', '').trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const effectType = get(effect, 'effectType')
    if (!['burst', 'orbit', 'spiral', 'vortex'].includes(effectType)) {
      errors.push(`${path}.effectType is invalid`)
    }
    if (!(typeof get(effect, 'enabled') === 'boolean')) {
      errors.push(`${path}.enabled must be a boolean`)
    }
    const particles = get(effect, 'particles')
    if (!isRecord(particles)) {
      errors.push(`${path}.particles must be an object`)
      continue
    }
    for (const field of ['texturePath']) {
      if (!(typeof get(particles, field) === 'string') || !get(particles, field, '').trim()) {
        errors.push(`${path}.particles.${field} must be a non-empty string`)
      }
    }
    for (const field of ['isOneShot', 'autoDispose']) {
      if (!(typeof get(particles, field) === 'boolean')) {
        errors.push(`${path}.particles.${field} must be a boolean`)
      }
    }
    for (const field of ['capacity', 'minLifeTime', 'maxLifeTime', 'emitDuration', 'emitRate', 'minEmitPower', 'maxEmitPower', 'updateSpeed']) {
      if (!hasValue(isFiniteNumber(get(particles, field)))) {
        errors.push(`${path}.particles.${field} must be a finite number`)
      }
    }
    for (const field of ['colorGradients', 'sizeGradients']) {
      if (!Array.isArray(get(particles, field))) {
        errors.push(`${path}.particles.${field} must be an array`)
      }
    }
    const behavior = get(effect, 'behavior')
    if (!isRecord(behavior)) {
      errors.push(`${path}.behavior must be an object`)
      continue
    }
    if (effectType === 'burst') {
      for (const field of ['minEmitBox', 'maxEmitBox', 'direction1', 'direction2', 'gravity']) {
        const value = get(behavior, field)
        if (!isRecord(value) || ['x', 'y', 'z'].some((axis) => !hasValue(isFiniteNumber(get(value, axis))))) {
          errors.push(`${path}.behavior.${field} must contain finite x/y/z`)
        }
      }
    } else if (['orbit', 'spiral', 'vortex'].includes(effectType)) {
      for (const field of ['radius', 'radiusRandomness', 'angularSpeed', 'angularSpeedRandomness', 'height', 'heightRandomness', 'radialSpeed', 'phaseRandomness']) {
        if (!hasValue(isFiniteNumber(get(behavior, field)))) {
          errors.push(`${path}.behavior.${field} must be a finite number`)
        }
      }
      axis = get(behavior, 'rotationAxis')
      if (!isRecord(axis) || ['x', 'y', 'z'].some((item) => !hasValue(isFiniteNumber(get(axis, item))))) {
        errors.push(`${path}.behavior.rotationAxis must contain finite x/y/z`)
      }
      for (const field of ['clockwise', 'followEmitter']) {
        if (!(typeof get(behavior, field) === 'boolean')) {
          errors.push(`${path}.behavior.${field} must be a boolean`)
        }
      }
      if (effectType === 'spiral' && !hasValue(isFiniteNumber(get(behavior, 'verticalSpeed')))) {
        errors.push(`${path}.behavior.verticalSpeed must be a finite number`)
      }
      if (effectType === 'vortex') {
        for (const field of ['inwardSpeed', 'endRadius']) {
          if (!hasValue(isFiniteNumber(get(behavior, field)))) {
            errors.push(`${path}.behavior.${field} must be a finite number`)
          }
        }
      }
    }
  }
  return errors
}

export function validateParticlePresetPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('root 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const presetKey = reqStr(preset, 'presetKey', errors, pPath)
    reqStr(preset, 'name', errors, pPath)
    reqStr(preset, 'visualPresetKey', errors, pPath)
    if (hasValue(presetKey) && key !== presetKey) {
      errors.push(`${pPath}.presetKey 必须与对象 key 一致`)
    }
    for (const boolField of ['isOneShot', 'autoDispose', 'forceDepthWrite', 'applyFog']) {
      if (!(typeof get(preset, boolField) === 'boolean')) {
        errors.push(`${pPath}.${boolField} 必须是布尔值`)
      }
    }
    reqNum(preset, 'capacity', errors, pPath, 1)
    const minLife = reqNum(preset, 'minLifeTime', errors, pPath, 0.01)
    const maxLife = reqNum(preset, 'maxLifeTime', errors, pPath, 0.01)
    if (minLife > maxLife) {
      errors.push(`${pPath}.minLifeTime 不能大于 maxLifeTime`)
    }
    reqNum(preset, 'emitDuration', errors, pPath, 0.01)
    reqNum(preset, 'emitRate', errors, pPath, 1)
    const minPower = reqNum(preset, 'minEmitPower', errors, pPath, 0.01)
    const maxPower = reqNum(preset, 'maxEmitPower', errors, pPath, 0.01)
    if (minPower > maxPower) {
      errors.push(`${pPath}.minEmitPower 不能大于 maxEmitPower`)
    }
    reqNum(preset, 'updateSpeed', errors, pPath, 0.0001)
    reqNum(preset, 'minInitialRotationDeg', errors, pPath)
    reqNum(preset, 'maxInitialRotationDeg', errors, pPath)
    reqNum(preset, 'minAngularSpeedDeg', errors, pPath)
    reqNum(preset, 'maxAngularSpeedDeg', errors, pPath)
    reqNum(preset, 'minScaleX', errors, pPath, 0.0001)
    reqNum(preset, 'maxScaleX', errors, pPath, 0.0001)
    reqNum(preset, 'minScaleY', errors, pPath, 0.0001)
    reqNum(preset, 'maxScaleY', errors, pPath, 0.0001)
    reqNum(preset, 'startDelayMs', errors, pPath, 0)
    reqNum(preset, 'preWarmCycles', errors, pPath, 0)
    reqNum(preset, 'preWarmStepOffset', errors, pPath, 0)
    reqNum(preset, 'renderingGroupId', errors, pPath, 0, 3)
    reqNum(preset, 'emitterRadius', errors, pPath, 0.0001)
    reqNum(preset, 'emitterRadiusRange', errors, pPath, 0, 1)
    reqNum(preset, 'emitterHeight', errors, pPath, 0.0001)
    reqNum(preset, 'emitterDirectionRandomizer', errors, pPath, 0, 1)
    reqNum(preset, 'emitterAngleDeg', errors, pPath, 0.1, 179)
    if (!['all', 'y', 'stretched'].includes(get(preset, 'billboardMode'))) {
      errors.push(`${pPath}.billboardMode 必须是 all、y 或 stretched`)
    }
    if (!['box', 'point', 'sphere', 'hemisphere', 'cylinder', 'cone'].includes(get(preset, 'emitterType'))) {
      errors.push(`${pPath}.emitterType 无效`)
    }
    for (const vectorName of ['gravity', 'minEmitBox', 'maxEmitBox', 'direction1', 'direction2']) {
      const vector = reqObj(preset, vectorName, errors, pPath)
      for (const axis of ['x', 'y', 'z']) {
        reqNum(vector, axis, errors, `${pPath}.${vectorName}`)
      }
    }
  }
  return errors
}

export function validateParticleVisualPresetPayload(payload) {
  let entryPath
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, preset] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!isRecord(preset)) {
      errors.push(`${path} must be an object`)
      continue
    }
    const presetKey = reqStr(preset, 'presetKey', errors, path)
    reqStr(preset, 'name', errors, path)
    reqStr(preset, 'texturePath', errors, path)
    if (!['texture', 'gradient'].includes(get(preset, 'colorMode'))) {
      errors.push(`${path}.colorMode must be texture or gradient`)
    }
    if (!['alpha', 'add', 'multiply', 'overwrite'].includes(get(preset, 'blendMode'))) {
      errors.push(`${path}.blendMode must be alpha, add, multiply or overwrite`)
    }
    if (hasValue(presetKey) && presetKey !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    const baseSize = reqNum(preset, 'baseSize', errors, path, 0.0001)
    const minSize = reqNum(preset, 'minSize', errors, path, 0.0001)
    const maxSize = reqNum(preset, 'maxSize', errors, path, 0.0001)
    if (minSize > maxSize) {
      errors.push(`${path}.minSize must not exceed maxSize`)
    }
    if (baseSize <= 0) {
      errors.push(`${path}.baseSize must be positive`)
    }
    const baseColor = reqObj(preset, 'baseColor', errors, path)
    for (const channel of ['r', 'g', 'b', 'a']) {
      reqNum(baseColor, channel, errors, `${path}.baseColor`, COLOR_MIN, COLOR_MAX)
    }
    for (const boolField of ['colorGradientsEnabled', 'sizeGradientsEnabled']) {
      if (!(typeof get(preset, boolField) === 'boolean')) {
        errors.push(`${path}.${boolField} must be a boolean`)
      }
    }
    const spriteSheet = get(preset, 'spriteSheet')
    if (spriteSheet !== null) {
      if (!isRecord(spriteSheet)) {
        errors.push(`${path}.spriteSheet must be an object`)
      } else {
        reqNum(spriteSheet, 'cellWidth', errors, `${path}.spriteSheet`, 1)
        reqNum(spriteSheet, 'cellHeight', errors, `${path}.spriteSheet`, 1)
        const startCell = reqNum(spriteSheet, 'startCellID', errors, `${path}.spriteSheet`, 0)
        const endCell = reqNum(spriteSheet, 'endCellID', errors, `${path}.spriteSheet`, 0)
        if (startCell > endCell) {
          errors.push(`${path}.spriteSheet.startCellID must not exceed endCellID`)
        }
        if (!(typeof get(spriteSheet, 'randomStartCell') === 'boolean')) {
          errors.push(`${path}.spriteSheet.randomStartCell must be a boolean`)
        }
        if (!['random-static', 'loop'].includes(get(spriteSheet, 'playbackMode'))) {
          errors.push(`${path}.spriteSheet.playbackMode is invalid`)
        }
        reqNum(spriteSheet, 'framesPerSecond', errors, `${path}.spriteSheet`, 0.1)
      }
    }
    const colors = get(preset, 'colorGradients')
    if (!Array.isArray(colors)) {
      errors.push(`${path}.colorGradients must be an array`)
    } else {
      for (const [index, entry] of enumerate(colors)) {
        entryPath = `${path}.colorGradients[${index}]`
        if (!isRecord(entry)) {
          errors.push(`${entryPath} must be an object`)
          continue
        }
        reqNum(entry, 'offset', errors, entryPath, 0, 1)
        const color = reqObj(entry, 'color', errors, entryPath)
        for (const channel of ['r', 'g', 'b', 'a']) {
          reqNum(color, channel, errors, `${entryPath}.color`, COLOR_MIN, COLOR_MAX)
        }
      }
    }
    const sizes = get(preset, 'sizeGradients')
    if (!Array.isArray(sizes)) {
      errors.push(`${path}.sizeGradients must be an array`)
    } else {
      for (const [index, entry] of enumerate(sizes)) {
        entryPath = `${path}.sizeGradients[${index}]`
        if (!isRecord(entry)) {
          errors.push(`${entryPath} must be an object`)
          continue
        }
        reqNum(entry, 'offset', errors, entryPath, 0, 1)
        reqNum(entry, 'size', errors, entryPath, 0.0001)
      }
    }
  }
  return errors
}

export function validateStripePresetPayload(payload) {
  let mode
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('root 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const pKey = reqStr(preset, 'presetKey', errors, pPath)
    reqStr(preset, 'name', errors, pPath)
    if (hasValue(pKey) && pKey !== key) {
      errors.push(`${pPath}.presetKey 必须与对象 key 一致`)
    }
    reqNum(preset, 'angleDeg', errors, pPath, -360, 360)
    reqNum(preset, 'speed', errors, pPath, -5000, 5000)
    mode = get(preset, 'mode')
    if (mode !== null) {
      if (!(typeof mode === 'string')) {
        errors.push(`${pPath}.mode 必须是字符串`)
        mode = 'stripes'
      } else if (!['stripes', 'solid'].includes(mode)) {
        errors.push(`${pPath}.mode 仅支持 stripes / solid`)
        mode = 'stripes'
      }
    } else {
      mode = 'stripes'
    }
    const background = get(preset, 'background')
    if (background !== null && !(typeof background === 'string')) {
      errors.push(`${pPath}.background 必须是字符串`)
    }
    if (mode === 'solid') {
      reqStr(preset, 'solidColor', errors, pPath)
      continue
    }
    const segments = get(preset, 'segments')
    if (!Array.isArray(segments) || sizeOf(segments) === 0) {
      errors.push(`${pPath}.segments 至少需要 1 段`)
      continue
    }
    for (const [idx, segment] of enumerate(segments)) {
      const sPath = `${pPath}.segments[${idx}]`
      if (!isRecord(segment)) {
        errors.push(`${sPath} 必须是对象`)
        continue
      }
      reqNum(segment, 'width', errors, sPath, 0.01)
      const fillType = reqStr(segment, 'fillType', errors, sPath)
      if (!['solid', 'gradient'].includes(fillType)) {
        errors.push(`${sPath}.fillType 仅支持 solid / gradient`)
        continue
      }
      if (fillType === 'solid') {
        reqStr(segment, 'color', errors, sPath)
      } else {
        reqStr(segment, 'fromColor', errors, sPath)
        reqStr(segment, 'toColor', errors, sPath)
      }
      const opacity = get(segment, 'opacity')
      if (opacity !== null) {
        reqNum(segment, 'opacity', errors, sPath, 0, 1)
      }
    }
  }
  return errors
}

export function validateSpriteAnimationPayload(payload) {
  let rigs
  let clips
  let pPath
  let rigId
  let parts
  let partId
  let lastTime
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  rigs = get(payload, 'rigs')
  clips = get(payload, 'clips')
  if (!isRecord(rigs)) {
    errors.push('rigs 必须是对象')
    rigs = {}
  }
  if (!isRecord(clips)) {
    errors.push('clips 必须是对象')
    clips = {}
  }
  for (const [key, rig] of Object.entries(rigs)) {
    pPath = `rigs[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('rigs 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(rig)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    rigId = reqStr(rig, 'rigId', errors, pPath)
    if (hasValue(rigId) && rigId !== key) {
      errors.push(`${pPath}.rigId 必须与 key 一致`)
    }
    reqStr(rig, 'atlasJsonPath', errors, pPath)
    reqStr(rig, 'atlasImagePath', errors, pPath)
    if (get(rig, 'baseSize') !== null) {
      reqNum(rig, 'baseSize', errors, pPath, 0.01)
    }
    parts = get(rig, 'parts')
    if (!Array.isArray(parts) || sizeOf(parts) === 0) {
      errors.push(`${pPath}.parts 至少需要一个部件`)
      continue
    }
    const seen = new Set()
    for (const [idx, part] of enumerate(parts)) {
      const partPath = `${pPath}.parts[${idx}]`
      if (!isRecord(part)) {
        errors.push(`${partPath} 必须是对象`)
        continue
      }
      partId = reqStr(part, 'partId', errors, partPath)
      if (hasValue(partId)) {
        if (contains(seen, partId)) {
          errors.push(`${pPath} 重复 partId: ${partId}`)
        }
        seen.add(partId)
      }
      for (const optionalStr of ['atlasJsonPath', 'atlasImagePath', 'defaultFrameName', 'label']) {
        if (get(part, optionalStr) !== null && !(typeof get(part, optionalStr) === 'string')) {
          errors.push(`${partPath}.${optionalStr} 必须是字符串`)
        }
      }
      if (get(part, 'zIndex') !== null) {
        reqNum(part, 'zIndex', errors, partPath)
      }
      const transform = get(part, 'transform')
      if (transform !== null) {
        if (!isRecord(transform)) {
          errors.push(`${partPath}.transform 必须是对象`)
        } else {
          for (const field of ['x', 'y', 'rotationDeg', 'scaleX', 'scaleY']) {
            if (get(transform, field) !== null) {
              reqNum(transform, field, errors, `${partPath}.transform`)
            }
          }
        }
      }
    }
  }
  for (const [key, clip] of Object.entries(clips)) {
    pPath = `clips[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('clips 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(clip)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const clipId = reqStr(clip, 'clipId', errors, pPath)
    if (hasValue(clipId) && clipId !== key) {
      errors.push(`${pPath}.clipId 必须与 key 一致`)
    }
    rigId = reqStr(clip, 'rigId', errors, pPath)
    if (hasValue(rigId) && !contains(rigs, rigId)) {
      errors.push(`${pPath}.rigId 引用了不存在的 rig: ${rigId}`)
    }
    reqNum(clip, 'fps', errors, pPath, 0.01)
    if (get(clip, 'duration') !== null) {
      reqNum(clip, 'duration', errors, pPath, 0)
    }
    if (!(typeof get(clip, 'loop') === 'boolean')) {
      errors.push(`${pPath}.loop 必须是布尔值`)
    }
    const keys = get(clip, 'keys')
    if (!Array.isArray(keys)) {
      errors.push(`${pPath}.keys 必须是数组`)
      continue
    }
    lastTime = -1.0
    for (const [idx, keyframe] of enumerate(keys)) {
      const kPath = `${pPath}.keys[${idx}]`
      if (!isRecord(keyframe)) {
        errors.push(`${kPath} 必须是对象`)
        continue
      }
      const timeVal = reqNum(keyframe, 'time', errors, kPath, 0)
      if (timeVal < lastTime) {
        errors.push(`${pPath}.keys 必须按 time 升序`)
      }
      lastTime = timeVal
      parts = get(keyframe, 'parts')
      if (!isRecord(parts)) {
        errors.push(`${kPath}.parts 必须是对象`)
        continue
      }
      for (const [partIdEntry, pose] of Object.entries(parts)) {
        partId = partIdEntry
        const posePath = `${kPath}.parts[${partId}]`
        if (!isRecord(pose)) {
          errors.push(`${posePath} 必须是对象`)
          continue
        }
        if (get(pose, 'frameName') !== null && !(typeof get(pose, 'frameName') === 'string')) {
          errors.push(`${posePath}.frameName 必须是字符串`)
        }
        if (get(pose, 'visible') !== null && !(typeof get(pose, 'visible') === 'boolean')) {
          errors.push(`${posePath}.visible 必须是布尔值`)
        }
        for (const field of ['x', 'y', 'rotationDeg', 'scaleX', 'scaleY']) {
          if (get(pose, field) !== null) {
            reqNum(pose, field, errors, posePath)
          }
        }
      }
    }
  }
  return errors
}

export function validateMonsterDisplayPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  const validLayerKeys = new Set(['bottomFillMask', 'bottomBorder', 'body', 'line'])
  const seenIds = {}
  for (const [key, config] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('root 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const cfgId = reqStr(config, 'id', errors, pPath)
    reqStr(config, 'name', errors, pPath)
    if (hasValue(cfgId) && cfgId !== key) {
      errors.push(`${pPath}.id 必须与对象 key 一致`)
    }
    if (hasValue(cfgId)) {
      const lowered = cfgId.toLowerCase()
      if (contains(seenIds, lowered) && seenIds[lowered] !== key) {
        errors.push(`${pPath}.id 与 ${seenIds[lowered]} 重复（忽略大小写）`)
      } else {
        seenIds[lowered] = key
      }
    }
    reqNum(config, 'scaleSize', errors, pPath, 1)
    const scene3dScale = get(config, 'scene3dScale')
    if (scene3dScale !== null) {
      reqNum(config, 'scene3dScale', errors, pPath, 0.01)
    }
    const scene3dHeight = get(config, 'scene3dHeight')
    if (scene3dHeight !== null) {
      reqNum(config, 'scene3dHeight', errors, pPath)
    }
    const scene3dOffsetX = get(config, 'scene3dOffsetX')
    if (scene3dOffsetX !== null) {
      reqNum(config, 'scene3dOffsetX', errors, pPath)
    }
    const spriteFacingAxis = get(config, 'spriteFacingAxis')
    if (spriteFacingAxis !== null) {
      if (!(typeof spriteFacingAxis === 'string')) {
        errors.push(`${pPath}.spriteFacingAxis 必须是字符串`)
      } else if (!contains(new Set(['+Z', '-Z']), spriteFacingAxis)) {
        errors.push(`${pPath}.spriteFacingAxis 仅支持 +Z / -Z`)
      }
    }
    const stripePresetBinding = get(config, 'monsterStripePresetKey')
    if (stripePresetBinding !== null && !(typeof stripePresetBinding === 'string')) {
      errors.push(`${pPath}.monsterStripePresetKey 必须是字符串`)
    }
    const renderOrder = get(config, 'renderOrder')
    if (!Array.isArray(renderOrder) || sizeOf(renderOrder) === 0) {
      errors.push(`${pPath}.renderOrder 必须是非空数组`)
    } else {
      const seen = new Set()
      for (const [idx, layerKey] of enumerate(renderOrder)) {
        if (!(typeof layerKey === 'string')) {
          errors.push(`${pPath}.renderOrder[${idx}] 必须是字符串`)
          continue
        }
        if (!contains(validLayerKeys, layerKey)) {
          errors.push(`${pPath}.renderOrder[${idx}] 非法图层 key: ${layerKey}`)
        }
        if (contains(seen, layerKey)) {
          errors.push(`${pPath}.renderOrder 出现重复图层 key: ${layerKey}`)
        }
        seen.add(layerKey)
      }
    }
    const layers = get(config, 'layers')
    if (!isRecord(layers)) {
      errors.push(`${pPath}.layers 必须是对象`)
      continue
    }
    for (const layerKey of iterable(validLayerKeys)) {
      const layer = get(layers, layerKey)
      const layerPath = `${pPath}.layers[${layerKey}]`
      if (!isRecord(layer)) {
        errors.push(`${layerPath} 必须是对象`)
        continue
      }
      reqStr(layer, 'path', errors, layerPath)
      const stripeKey = get(layer, 'stripePresetKey')
      if (stripeKey !== null && !(typeof stripeKey === 'string')) {
        errors.push(`${layerPath}.stripePresetKey 必须是字符串`)
      }
    }
    for (const providedKey of Object.keys(layers)) {
      if (!contains(validLayerKeys, providedKey)) {
        errors.push(`${pPath}.layers 包含未知图层 key: ${providedKey}`)
      }
    }
  }
  return errors
}

export function validateMonsterStripePresetPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  const validLayerKeys = new Set(['bottomFillMask', 'bottomBorder', 'body', 'line'])
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('root 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const presetId = reqStr(preset, 'id', errors, pPath)
    reqStr(preset, 'name', errors, pPath)
    if (hasValue(presetId) && presetId !== key) {
      errors.push(`${pPath}.id 必须与对象 key 一致`)
    }
    const layers = get(preset, 'layers')
    if (!isRecord(layers)) {
      errors.push(`${pPath}.layers 必须是对象`)
      continue
    }
    for (const layerKey of iterable(validLayerKeys)) {
      const layer = get(layers, layerKey)
      const layerPath = `${pPath}.layers[${layerKey}]`
      if (!isRecord(layer)) {
        errors.push(`${layerPath} 必须是对象`)
        continue
      }
      const stripeKey = get(layer, 'stripePresetKey')
      if (stripeKey !== null && !(typeof stripeKey === 'string')) {
        errors.push(`${layerPath}.stripePresetKey 必须是字符串`)
      }
    }
    for (const providedKey of Object.keys(layers)) {
      if (!contains(validLayerKeys, providedKey)) {
        errors.push(`${pPath}.layers 包含未知图层 key: ${providedKey}`)
      }
    }
  }
  return errors
}

export function validatePopNumberPresetPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  const validNumberModes = new Set(['range', 'fixed'])
  const validPopModes = new Set(['float', 'projectile'])
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('root 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const presetKey = reqStr(preset, 'presetKey', errors, pPath)
    reqStr(preset, 'name', errors, pPath)
    if (hasValue(presetKey) && presetKey !== key) {
      errors.push(`${pPath}.presetKey 必须与对象 key 一致`)
    }
    const numberMode = reqStr(preset, 'numberMode', errors, pPath)
    const popMode = reqStr(preset, 'popMode', errors, pPath)
    if (hasValue(numberMode) && !contains(validNumberModes, numberMode)) {
      errors.push(`${pPath}.numberMode 仅支持 range / fixed`)
    }
    if (hasValue(popMode) && !contains(validPopModes, popMode)) {
      errors.push(`${pPath}.popMode 仅支持 float / projectile`)
    }
    const minValue = reqNum(preset, 'minValue', errors, pPath)
    const maxValue = reqNum(preset, 'maxValue', errors, pPath)
    reqNum(preset, 'fixedValue', errors, pPath)
    if (minValue > maxValue) {
      errors.push(`${pPath}.minValue 不能大于 maxValue`)
    }
    reqNum(preset, 'lifeMs', errors, pPath, 100)
    if (!(typeof get(preset, 'enableGlow') === 'boolean')) {
      errors.push(`${pPath}.enableGlow 必须是布尔值`)
    }
    const dirMin = reqNum(preset, 'directionMinDeg', errors, pPath)
    const dirMax = reqNum(preset, 'directionMaxDeg', errors, pPath)
    if (dirMin > dirMax) {
      errors.push(`${pPath}.directionMinDeg 不能大于 directionMaxDeg`)
    }
    const speedMin = reqNum(preset, 'speedMin', errors, pPath, 0)
    const speedMax = reqNum(preset, 'speedMax', errors, pPath, 0)
    if (speedMin > speedMax) {
      errors.push(`${pPath}.speedMin 不能大于 speedMax`)
    }
    reqNum(preset, 'gravity', errors, pPath)
  }
  return errors
}

export function validateBurstCapsulePresetPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body 必须是 JSON 对象']
  }
  const validDecayModes = new Set(['fade', 'shrink'])
  const validColorModes = new Set(['single', 'random'])
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('root 的 key 必须是非空字符串')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} 必须是对象`)
      continue
    }
    const presetKey = reqStr(preset, 'presetKey', errors, pPath)
    reqStr(preset, 'name', errors, pPath)
    if (hasValue(presetKey) && presetKey !== key) {
      errors.push(`${pPath}.presetKey 必须与对象 key 一致`)
    }
    const controls = reqObj(preset, 'controls', errors, pPath)
    if (!hasValue(controls)) {
      continue
    }
    reqNum(controls, 'spawnCount', errors, `${pPath}.controls`, 1)
    reqNum(controls, 'spawnJitter', errors, `${pPath}.controls`, 0)
    const speedMin = reqNum(controls, 'speedMin', errors, `${pPath}.controls`, 0)
    const speedMax = reqNum(controls, 'speedMax', errors, `${pPath}.controls`, 0)
    if (speedMin > speedMax) {
      errors.push(`${pPath}.controls.speedMin 不能大于 speedMax`)
    }
    reqNum(controls, 'friction', errors, `${pPath}.controls`, 0)
    const decayMin = reqNum(controls, 'decayMin', errors, `${pPath}.controls`, 0)
    const decayMax = reqNum(controls, 'decayMax', errors, `${pPath}.controls`, 0)
    if (decayMin > decayMax) {
      errors.push(`${pPath}.controls.decayMin 不能大于 decayMax`)
    }
    const lengthMin = reqNum(controls, 'lengthMin', errors, `${pPath}.controls`, 0)
    const lengthMax = reqNum(controls, 'lengthMax', errors, `${pPath}.controls`, 0)
    if (lengthMin > lengthMax) {
      errors.push(`${pPath}.controls.lengthMin 不能大于 lengthMax`)
    }
    const thicknessMin = reqNum(controls, 'thicknessMin', errors, `${pPath}.controls`, 0)
    const thicknessMax = reqNum(controls, 'thicknessMax', errors, `${pPath}.controls`, 0)
    if (thicknessMin > thicknessMax) {
      errors.push(`${pPath}.controls.thicknessMin 不能大于 thicknessMax`)
    }
    reqNum(controls, 'outlineWidth', errors, `${pPath}.controls`, 0)
    reqNum(controls, 'trailAlpha', errors, `${pPath}.controls`, 0, 1)
    reqNum(controls, 'shrinkPower', errors, `${pPath}.controls`, 0.0001)
    const decayMode = reqStr(controls, 'decayVisualMode', errors, `${pPath}.controls`)
    if (hasValue(decayMode) && !contains(validDecayModes, decayMode)) {
      errors.push(`${pPath}.controls.decayVisualMode 仅支持 fade / shrink`)
    }
    const colorMode = reqStr(controls, 'colorMode', errors, `${pPath}.controls`)
    if (hasValue(colorMode) && !contains(validColorModes, colorMode)) {
      errors.push(`${pPath}.controls.colorMode 仅支持 single / random`)
    }
    reqStr(controls, 'singleMainColor', errors, `${pPath}.controls`)
    reqStr(controls, 'singleStrokeColor', errors, `${pPath}.controls`)
  }
  return errors
}

export function validateModelScenePresetPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('preset key must be a non-empty string')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} must be an object`)
      continue
    }
    const presetId = get(preset, 'id')
    if (!(typeof presetId === 'string') || !presetId.trim()) {
      errors.push(`${pPath}.id must be a non-empty string`)
    } else if (presetId !== key) {
      errors.push(`${pPath}.id must match its object key`)
    }
    if (!(typeof get(preset, 'name') === 'string') || !get(preset, 'name', '').trim()) {
      errors.push(`${pPath}.name must be a non-empty string`)
    }
    const instances = get(preset, 'instances')
    if (!Array.isArray(instances)) {
      errors.push(`${pPath}.instances must be an array`)
      continue
    }
    const seenIds = new Set()
    for (const [index, instance] of enumerate(instances)) {
      const iPath = `${pPath}.instances[${index}]`
      if (!isRecord(instance)) {
        errors.push(`${iPath} must be an object`)
        continue
      }
      const instanceId = get(instance, 'id')
      if (!(typeof instanceId === 'string') || !instanceId.trim()) {
        errors.push(`${iPath}.id must be a non-empty string`)
      } else if (contains(seenIds, instanceId)) {
        errors.push(`${iPath}.id is duplicated: ${instanceId}`)
      } else {
        seenIds.add(instanceId)
      }
      if (!(typeof get(instance, 'name') === 'string') || !get(instance, 'name', '').trim()) {
        errors.push(`${iPath}.name must be a non-empty string`)
      }
      const modelPath = get(instance, 'modelPath')
      if (contains(instance, 'materialOverrides')) {
        try {
          validateModelMaterialBindings(instance.materialOverrides)
        } catch (error) {
          errors.push(`${iPath}.materialOverrides: ${error}`)
        }
      }
      if (!(typeof modelPath === 'string') || !modelPath.startsWith('/resources/') || !['.glb', '.gltf'].some(extension => splitOnce(modelPath.toLowerCase(), '?')[0].endsWith(extension))) {
        errors.push(`${iPath}.modelPath must be a /resources/*.glb or *.gltf path`)
      }
      const transform = get(instance, 'transform')
      if (!isRecord(transform)) {
        errors.push(`${iPath}.transform must be an object`)
        continue
      }
      for (const field of ['position', 'rotationDeg', 'scaling']) {
        const value = get(transform, field)
        if (!Array.isArray(value) || sizeOf(value) !== 3 || value.some((item) => !(typeof item === 'number' || typeof item === 'boolean'))) {
          errors.push(`${iPath}.transform.${field} must contain three numbers`)
        }
      }
      const scaling = get(transform, 'scaling')
      if (Array.isArray(scaling) && sizeOf(scaling) === 3 && scaling.some((item) => (typeof item === 'number' || typeof item === 'boolean') && item === 0)) {
        errors.push(`${iPath}.transform.scaling cannot contain zero`)
      }
    }
  }
  return errors
}

export function validateModelShakePresetPayload(payload) {
  let minimum
  let maximum
  let legacy
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  const scalarRanges = {durationMs: [30, 10000], frequencyHz: [0.1, 120]}
  const channelRanges = {positionX: 100, positionY: 100, positionZ: 100, rotationX: 180, rotationY: 180, rotationZ: 180, scaleX: 3, scaleY: 3, scaleZ: 3}
  for (const [key, preset] of Object.entries(payload)) {
    const pPath = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('preset key must be a non-empty string')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${pPath} must be an object`)
      continue
    }
    const presetKey = get(preset, 'presetKey')
    if (!(typeof presetKey === 'string') || !presetKey.trim()) {
      errors.push(`${pPath}.presetKey must be a non-empty string`)
    } else if (presetKey !== key) {
      errors.push(`${pPath}.presetKey must match its object key`)
    }
    if (!(typeof get(preset, 'name') === 'string') || !get(preset, 'name', '').trim()) {
      errors.push(`${pPath}.name must be a non-empty string`)
    }
    const controls = get(preset, 'controls')
    if (!isRecord(controls)) {
      errors.push(`${pPath}.controls must be an object`)
      continue
    }
    for (const field of ['positionEnabled', 'rotationEnabled', 'scaleEnabled']) {
      if (contains(controls, field) && !(typeof controls[field] === 'boolean')) {
        errors.push(`${pPath}.controls.${field} must be a boolean`)
      }
    }
    if (contains(controls, 'mode') && !['wave', 'random'].includes(controls.mode)) {
      errors.push(`${pPath}.controls.mode must be wave or random`)
    }
    for (const [field, [minimumEntry, maximumEntry]] of Object.entries(scalarRanges)) {
      minimum = minimumEntry
      maximum = maximumEntry
      const value = get(controls, field)
      if (!(typeof value === 'number' || typeof value === 'boolean') || typeof value === 'boolean') {
        errors.push(`${pPath}.controls.${field} must be a number`)
      } else if (value < minimum || value > maximum) {
        errors.push(`${pPath}.controls.${field} must be between ${minimum} and ${maximum}`)
      }
    }
    for (const [prefix, limit] of Object.entries(channelRanges)) {
      minimum = get(controls, `${prefix}Min`)
      maximum = get(controls, `${prefix}Max`)
      legacy = get(controls, prefix)
      if (legacy === null && prefix.startsWith('scale')) {
        legacy = get(controls, 'scale')
      }
      if (minimum === null && maximum === null && (typeof legacy === 'number' || typeof legacy === 'boolean') && !(typeof legacy === 'boolean')) {
        continue
      }
      if (!(typeof minimum === 'number' || typeof minimum === 'boolean') || typeof minimum === 'boolean') {
        errors.push(`${pPath}.controls.${prefix}Min must be a number`)
        continue
      }
      if (!(typeof maximum === 'number' || typeof maximum === 'boolean') || typeof maximum === 'boolean') {
        errors.push(`${pPath}.controls.${prefix}Max must be a number`)
        continue
      }
      if (minimum < -limit || minimum > limit || maximum < -limit || maximum > limit) {
        errors.push(`${pPath}.controls.${prefix} range must be between ${-limit} and ${limit}`)
      } else if (minimum > maximum) {
        errors.push(`${pPath}.controls.${prefix}Min cannot exceed ${prefix}Max`)
      }
    }
  }
  return errors
}

export function validateModelDisplayConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('model path key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'modelPath') !== key) {
      errors.push(`${path}.modelPath must match its object key`)
    }
    if (contains(config, 'materialOverrides')) {
      try {
        validateModelMaterialBindings(config.materialOverrides)
      } catch (error) {
        errors.push(`${path}.materialOverrides: ${error}`)
      }
    }
    const rotation = get(config, 'rotationDeg')
    if (!isRecord(rotation)) {
      errors.push(`${path}.rotationDeg must be an object`)
    } else {
      for (const axis of ['x', 'y', 'z']) {
        const value = get(rotation, axis)
        if (!hasValue(isFiniteNumber(value)) || value < -360 || value > 360) {
          errors.push(`${path}.rotationDeg.${axis} must be between -360 and 360`)
        }
      }
    }
    const scale = get(config, 'scale')
    if (!hasValue(isFiniteNumber(scale)) || scale < 0.001 || scale > 1000) {
      errors.push(`${path}.scale must be between 0.001 and 1000`)
    }
    const cameraDistance = get(config, 'cameraDistance')
    if (!hasValue(isFiniteNumber(cameraDistance)) || cameraDistance < 0.01 || cameraDistance > 100000) {
      errors.push(`${path}.cameraDistance must be between 0.01 and 100000`)
    }
    const speed = get(config, 'rotationSpeedDegPerSec')
    if (!hasValue(isFiniteNumber(speed)) || speed < -720 || speed > 720) {
      errors.push(`${path}.rotationSpeedDegPerSec must be between -720 and 720`)
    }
  }
  return errors
}

export function validateModelSwingConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('model path key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'modelPath') !== key) {
      errors.push(`${path}.modelPath must match its object key`)
    }
    if (!(typeof get(config, 'enabled') === 'boolean')) {
      errors.push(`${path}.enabled must be a boolean`)
    }
    const rotation = get(config, 'baseRotationDeg')
    if (!isRecord(rotation)) {
      errors.push(`${path}.baseRotationDeg must be an object`)
    } else {
      for (const axis of ['x', 'y', 'z']) {
        const value = get(rotation, axis)
        if (!hasValue(isFiniteNumber(value)) || value < -360 || value > 360) {
          errors.push(`${path}.baseRotationDeg.${axis} must be between -360 and 360`)
        }
      }
    }
    if (!['x', 'y', 'z'].includes(get(config, 'axis'))) {
      errors.push(`${path}.axis must be x, y or z`)
    }
    const [minimum, maximum] = [get(config, 'minAngleDeg'), get(config, 'maxAngleDeg')]
    if (!hasValue(isFiniteNumber(minimum)) || !hasValue(isFiniteNumber(maximum)) || minimum < -360 || maximum > 360 || minimum > maximum) {
      errors.push(`${path}.angle range must be between -360 and 360 with minAngleDeg <= maxAngleDeg`)
    }
    const frequency = get(config, 'frequencyHz')
    if (!hasValue(isFiniteNumber(frequency)) || frequency < 0.01 || frequency > 30) {
      errors.push(`${path}.frequencyHz must be between 0.01 and 30`)
    }
    const phase = get(config, 'phaseDeg')
    if (!hasValue(isFiniteNumber(phase)) || phase < -360 || phase > 360) {
      errors.push(`${path}.phaseDeg must be between -360 and 360`)
    }
  }
  return errors
}

export function validateModelShootConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'modelPath') !== key) {
      errors.push(`${path}.modelPath must match its object key`)
    }
    for (const [field, minimum, maximum] of [['fireIntervalMs', 1, 60000], ['recoilAngleDeg', -180, 180]]) {
      if (!hasValue(isFiniteNumber(get(config, field))) || config[field] < minimum || config[field] > maximum) {
        errors.push(`${path}.${field} out of range`)
      }
    }
  }
  return errors
}

export function validateBulletConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'bulletKey') !== key) {
      errors.push(`${path}.bulletKey must match its object key`)
    }
    if (!['sphere', 'box', 'cylinder'].includes(get(config, 'shape'))) {
      errors.push(`${path}.shape must be sphere, box or cylinder`)
    }
    for (const [field, minimum, maximum] of [['scale', 0.01, 100], ['speed', 0.01, 1000]]) {
      if (!hasValue(isFiniteNumber(get(config, field))) || config[field] < minimum || config[field] > maximum) {
        errors.push(`${path}.${field} out of range`)
      }
    }
  }
  return errors
}

export function validateAvatarConfigPayload(payload) {
  let field
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, character] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('character key must be a non-empty string')
      continue
    }
    if (!isRecord(character)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(character, 'id') !== key) {
      errors.push(`${path}.id must match its object key`)
    }
    if (!(typeof get(character, 'name') === 'string') || !get(character, 'name', '').trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const container = get(character, 'container')
    if (!isRecord(container)) {
      errors.push(`${path}.container must be an object`)
    } else {
      if (!['square', 'rounded', 'circle', 'ellipse'].includes(get(container, 'shape'))) {
        errors.push(`${path}.container.shape is invalid`)
      }
      for (field of ['width', 'height']) {
        if (!hasValue(isFiniteNumber(get(container, field))) || container[field] < 48 || container[field] > 1600) {
          errors.push(`${path}.container.${field} must be between 48 and 1600`)
        }
      }
      if (!hasValue(isFiniteNumber(get(container, 'borderRadius'))) || container.borderRadius < 0) {
        errors.push(`${path}.container.borderRadius must be zero or greater`)
      }
    }
    const expressions = get(character, 'expressions')
    if (!Array.isArray(expressions)) {
      errors.push(`${path}.expressions must be an array`)
      continue
    }
    const seen = new Set()
    for (const [index, expression] of enumerate(expressions)) {
      const expressionPath = `${path}.expressions[${index}]`
      if (!isRecord(expression)) {
        errors.push(`${expressionPath} must be an object`)
        continue
      }
      const expressionId = get(expression, 'id')
      if (!(typeof expressionId === 'string') || !expressionId.trim()) {
        errors.push(`${expressionPath}.id must be a non-empty string`)
      } else if (contains(seen, expressionId)) {
        errors.push(`${expressionPath}.id must be unique`)
      } else {
        seen.add(expressionId)
      }
      if (!(typeof get(expression, 'name') === 'string') || !get(expression, 'name', '').trim()) {
        errors.push(`${expressionPath}.name must be a non-empty string`)
      }
      if (!(typeof get(expression, 'imagePath') === 'string')) {
        errors.push(`${expressionPath}.imagePath must be a string`)
      }
      for (field of ['offsetX', 'offsetY', 'scale']) {
        if (!hasValue(isFiniteNumber(get(expression, field)))) {
          errors.push(`${expressionPath}.${field} must be a finite number`)
        }
      }
      if (hasValue(isFiniteNumber(get(expression, 'scale'))) && expression.scale <= 0) {
        errors.push(`${expressionPath}.scale must be greater than zero`)
      }
      const atlas = get(expression, 'atlas')
      if (atlas !== null) {
        if (!isRecord(atlas)) {
          errors.push(`${expressionPath}.atlas must be an object`)
        } else if (!['jsonPath', 'frameName'].every((field) => typeof get(atlas, field) === 'string' && get(atlas, field).trim())) {
          errors.push(`${expressionPath}.atlas paths must be non-empty strings`)
        }
      }
    }
  }
  return errors
}

export function validateExclamationMarkPresetPayload(payload) {
  let value
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']
  for (const [key, preset] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('preset key must be a non-empty string')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(preset, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(preset, 'name') === 'string') || !get(preset, 'name', '').trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const imagePath = get(preset, 'imagePath')
    if (!(typeof imagePath === 'string') || !imagePath.startsWith('resources/') || !allowedExtensions.some(extension => splitOnce(imagePath.toLowerCase(), '?')[0].endsWith(extension))) {
      errors.push(`${path}.imagePath must be a resources image path`)
    }
    for (const field of ['height', 'scale']) {
      value = get(preset, field)
      if (!hasValue(isFiniteNumber(value)) || value <= 0 || value > 1000) {
        errors.push(`${path}.${field} must be greater than 0 and no more than 1000`)
      }
    }
    const position = get(preset, 'position')
    if (!Array.isArray(position) || sizeOf(position) !== 3 || position.some((value) => !hasValue(isFiniteNumber(value)))) {
      errors.push(`${path}.position must contain three finite numbers`)
    }
    if (!(typeof get(preset, 'faceCamera') === 'boolean')) {
      errors.push(`${path}.faceCamera must be a boolean`)
    }
    const fillPercent = get(preset, 'fillPercent')
    if (!hasValue(isFiniteNumber(fillPercent)) || fillPercent < 0 || fillPercent > 1) {
      errors.push(`${path}.fillPercent must be between 0 and 1`)
    }
    if (!['bottom-to-top', 'top-to-bottom', 'left-to-right', 'right-to-left'].includes(get(preset, 'fillDirection'))) {
      errors.push(`${path}.fillDirection is invalid`)
    }
    if (!['color', 'texture'].includes(get(preset, 'fillMode'))) {
      errors.push(`${path}.fillMode must be color or texture`)
    }
    if (!['color', 'texture'].includes(get(preset, 'backgroundMode'))) {
      errors.push(`${path}.backgroundMode must be color or texture`)
    }
    for (const field of ['fillColor', 'backgroundColor']) {
      const color = get(preset, field)
      if (!(typeof color === 'string') || sizeOf(color) !== 7 || !color.startsWith('#')) {
        errors.push(`${path}.${field} must be a #RRGGBB color`)
      } else {
        try {
          Math.trunc(color.slice(1, undefined), 16)
        } catch {
          errors.push(`${path}.${field} must be a #RRGGBB color`)
        }
      }
    }
    for (const field of ['fillOpacity', 'backgroundOpacity']) {
      const opacity = get(preset, field)
      if (!hasValue(isFiniteNumber(opacity)) || opacity < 0 || opacity > 1) {
        errors.push(`${path}.${field} must be between 0 and 1`)
      }
    }
  }
  return errors
}

export function validateMonsterExclamationPositionPayload(payload) {
  let value
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('monster config key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'monsterConfigKey') !== key) {
      errors.push(`${path}.monsterConfigKey must match its object key`)
    }
    for (const field of ['monsterPositionOffset', 'groupOffset']) {
      const vector = get(config, field)
      if (!Array.isArray(vector) || sizeOf(vector) !== 3 || vector.some((value) => !hasValue(isFiniteNumber(value)))) {
        errors.push(`${path}.${field} must contain three finite numbers`)
      }
    }
    const scale = get(config, 'groupScale')
    if (!hasValue(isFiniteNumber(scale)) || scale <= 0) {
      errors.push(`${path}.groupScale must be greater than zero`)
    }
    const spacing = get(config, 'spacing')
    if (!hasValue(isFiniteNumber(spacing)) || spacing < 0) {
      errors.push(`${path}.spacing must be zero or greater`)
    }
    const indicators = get(config, 'indicators')
    if (!Array.isArray(indicators)) {
      errors.push(`${path}.indicators must be an array`)
      continue
    }
    const seen = new Set()
    for (const [index, indicator] of enumerate(indicators)) {
      const indicatorPath = `${path}.indicators[${index}]`
      if (!isRecord(indicator)) {
        errors.push(`${indicatorPath} must be an object`)
        continue
      }
      const indicatorId = get(indicator, 'id')
      if (!(typeof indicatorId === 'string') || !indicatorId.trim()) {
        errors.push(`${indicatorPath}.id must be a non-empty string`)
      } else if (contains(seen, indicatorId)) {
        errors.push(`${indicatorPath}.id must be unique`)
      } else {
        seen.add(indicatorId)
      }
      if (!(typeof get(indicator, 'name') === 'string') || !get(indicator, 'name', '').trim()) {
        errors.push(`${indicatorPath}.name must be a non-empty string`)
      }
      for (const field of ['exclamationPresetKey', 'basePresetKey']) {
        if (!(typeof get(indicator, field) === 'string')) {
          errors.push(`${indicatorPath}.${field} must be a string`)
        }
      }
      if (!(typeof get(indicator, 'visible') === 'boolean')) {
        errors.push(`${indicatorPath}.visible must be a boolean`)
      }
      if (!hasValue(isFiniteNumber(get(indicator, 'order')))) {
        errors.push(`${indicatorPath}.order must be finite`)
      }
      for (const field of ['exclamationProgress', 'baseProgress']) {
        value = get(indicator, field)
        if (!hasValue(isFiniteNumber(value)) || value < -0.1 || value > 1.1) {
          errors.push(`${indicatorPath}.${field} must be between -0.1 and 1.1`)
        }
      }
      const offset = get(indicator, 'offset')
      if (!Array.isArray(offset) || sizeOf(offset) !== 3 || offset.some((value) => !hasValue(isFiniteNumber(value)))) {
        errors.push(`${indicatorPath}.offset must contain three finite numbers`)
      }
      for (const field of ['scale', 'baseScale']) {
        value = get(indicator, field)
        if (!hasValue(isFiniteNumber(value)) || value <= 0) {
          errors.push(`${indicatorPath}.${field} must be greater than zero`)
        }
      }
    }
  }
  return errors
}

export function validateSpecialStatusVisualPresetPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, preset] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('preset key must be a non-empty string')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(preset, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(preset, 'name') === 'string') || !get(preset, 'name', '').trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const statuses = get(preset, 'statuses')
    if (!isRecord(statuses)) {
      errors.push(`${path}.statuses must be an object`)
    } else {
      for (const [statusId, status] of Object.entries(statuses)) {
        const statusPath = `${path}.statuses[${statusId}]`
        if (!(typeof statusId === 'string') || !statusId.trim()) {
          errors.push(`${path}.statuses key must be a non-empty string`)
          continue
        }
        if (!isRecord(status)) {
          errors.push(`${statusPath} must be an object`)
          continue
        }
        if (get(status, 'id') !== statusId) {
          errors.push(`${statusPath}.id must match its object key`)
        }
        if (!(typeof get(status, 'name') === 'string') || !get(status, 'name', '').trim()) {
          errors.push(`${statusPath}.name must be a non-empty string`)
        }
        if (!(typeof get(status, 'imagePath') === 'string') || !get(status, 'imagePath', '').trim()) {
          errors.push(`${statusPath}.imagePath must be a non-empty string`)
        }
      }
    }
    const ui2d = get(preset, 'ui2d')
    if (!isRecord(ui2d)) {
      errors.push(`${path}.ui2d must be an object`)
    } else {
      for (const field of ['badgeSize', 'iconScale', 'valueFontSize', 'cornerInset', 'frameOffsetX', 'frameOffsetY', 'frameWidth', 'frameHeight']) {
        if (!hasValue(isFiniteNumber(get(ui2d, field)))) {
          errors.push(`${path}.ui2d.${field} must be a finite number`)
        }
      }
      const color = get(ui2d, 'textColor')
      if (!(typeof color === 'string') || sizeOf(color) !== 7 || !color.startsWith('#')) {
        errors.push(`${path}.ui2d.textColor must be a #RRGGBB color`)
      }
    }
    const config3d = get(preset, 'babylon3d')
    if (!isRecord(config3d)) {
      errors.push(`${path}.babylon3d must be an object`)
      continue
    }
    if (!(typeof get(config3d, 'numberPresetKey') === 'string') || !get(config3d, 'numberPresetKey', '').trim()) {
      errors.push(`${path}.babylon3d.numberPresetKey must be a non-empty string`)
    }
    for (const field of ['statusHeight', 'statusScale', 'numberScale', 'cornerInset']) {
      if (!hasValue(isFiniteNumber(get(config3d, field)))) {
        errors.push(`${path}.babylon3d.${field} must be a finite number`)
      }
    }
    const position = get(config3d, 'position')
    if (!Array.isArray(position) || sizeOf(position) !== 3 || position.some((value) => !hasValue(isFiniteNumber(value)))) {
      errors.push(`${path}.babylon3d.position must contain three finite numbers`)
    }
    const offsets = get(config3d, 'numberOffsets')
    if (!Array.isArray(offsets) || sizeOf(offsets) !== 4) {
      errors.push(`${path}.babylon3d.numberOffsets must contain four vectors`)
    } else {
      for (const [index, vector] of enumerate(offsets)) {
        if (!Array.isArray(vector) || sizeOf(vector) !== 3 || vector.some((value) => !hasValue(isFiniteNumber(value)))) {
          errors.push(`${path}.babylon3d.numberOffsets[${index}] must contain three finite numbers`)
        }
      }
    }
    if (!(typeof get(config3d, 'billboard') === 'boolean')) {
      errors.push(`${path}.babylon3d.billboard must be a boolean`)
    }
  }
  return errors
}

export function validateMonsterSpecialStatusPositionPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  const globalConfig = get(payload, 'global')
  if (!isRecord(globalConfig)) {
    errors.push('root.global must be an object')
  } else {
    if (!['+Z', '-Z'].includes(get(globalConfig, 'spriteFacingAxis'))) {
      errors.push('root.global.spriteFacingAxis must be +Z or -Z')
    }
    const scale = get(globalConfig, 'statusGroupScale')
    if (!hasValue(isFiniteNumber(scale)) || scale <= 0) {
      errors.push('root.global.statusGroupScale must be a positive finite number')
    }
    const spacing = get(globalConfig, 'statusSpacing')
    if (!Array.isArray(spacing) || sizeOf(spacing) !== 3 || spacing.some((value) => !hasValue(isFiniteNumber(value)))) {
      errors.push('root.global.statusSpacing must contain three finite numbers')
    }
    if (!(typeof get(globalConfig, 'visualPresetKey') === 'string')) {
      errors.push('root.global.visualPresetKey must be a string')
    }
  }
  const monsters = get(payload, 'monsters')
  if (!isRecord(monsters)) {
    errors.push('root.monsters must be an object')
    return errors
  }
  for (const [key, config] of Object.entries(monsters)) {
    const path = `root.monsters[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('monster config key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'monsterConfigKey') !== key) {
      errors.push(`${path}.monsterConfigKey must match its object key`)
    }
    const wrapCount = get(config, 'statusWrapCount')
    if (!hasValue(isFiniteNumber(wrapCount)) || wrapCount < 1 || Math.trunc(wrapCount) !== wrapCount) {
      errors.push(`${path}.statusWrapCount must be a positive integer`)
    }
    const offset = get(config, 'statusGroupOffset')
    if (!Array.isArray(offset) || sizeOf(offset) !== 3 || offset.some((value) => !hasValue(isFiniteNumber(value)))) {
      errors.push(`${path}.statusGroupOffset must contain three finite numbers`)
    }
  }
  return errors
}

export function validateMonsterBattlefieldFormationPayload(payload) {
  let value
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, battlefield] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('battlefield key must be a non-empty string')
      continue
    }
    if (!isRecord(battlefield)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(battlefield, 'id') !== key) {
      errors.push(`${path}.id must match its object key`)
    }
    if (!(typeof get(battlefield, 'name') === 'string') || !get(battlefield, 'name', '').trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const width = get(battlefield, 'width')
    if (!hasValue(isFiniteNumber(width)) || width < 1 || Math.trunc(width) !== width) {
      errors.push(`${path}.width must be a positive integer`)
    }
    for (const field of ['cellSize', 'rowSpacing']) {
      value = get(battlefield, field)
      if (!hasValue(isFiniteNumber(value)) || value <= 0) {
        errors.push(`${path}.${field} must be greater than zero`)
      }
    }
    const monsters = get(battlefield, 'monsters')
    if (!Array.isArray(monsters)) {
      errors.push(`${path}.monsters must be an array`)
      continue
    }
    const seenIds = new Set()
    for (const [index, monster] of enumerate(monsters)) {
      const monsterPath = `${path}.monsters[${index}]`
      if (!isRecord(monster)) {
        errors.push(`${monsterPath} must be an object`)
        continue
      }
      const monsterId = get(monster, 'id')
      if (!(typeof monsterId === 'string') || !monsterId.trim()) {
        errors.push(`${monsterPath}.id must be a non-empty string`)
      } else if (contains(seenIds, monsterId)) {
        errors.push(`${monsterPath}.id must be unique within the battlefield`)
      } else {
        seenIds.add(monsterId)
      }
      if (!(typeof get(monster, 'monsterConfigKey') === 'string') || !get(monster, 'monsterConfigKey', '').trim()) {
        errors.push(`${monsterPath}.monsterConfigKey must be a non-empty string`)
      }
      if (!(typeof get(monster, 'monsterStripePresetKey') === 'string') || !get(monster, 'monsterStripePresetKey', '').trim()) {
        errors.push(`${monsterPath}.monsterStripePresetKey must be a non-empty string`)
      }
      if (!['grid', 'center'].includes(get(monster, 'positionMode'))) {
        errors.push(`${monsterPath}.positionMode must be grid or center`)
      }
      for (const field of ['row', 'column']) {
        value = get(monster, field)
        if (!hasValue(isFiniteNumber(value)) || value < 0 || Math.trunc(value) !== value) {
          errors.push(`${monsterPath}.${field} must be a non-negative integer`)
        }
      }
      const slots = get(monster, 'slots')
      if (!hasValue(isFiniteNumber(slots)) || slots < 1 || Math.trunc(slots) !== slots) {
        errors.push(`${monsterPath}.slots must be a positive integer`)
      }
    }
  }
  return errors
}

export function validateMonsterBattlefieldStripeRulePayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('battlefield key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'battlefieldId') !== key) {
      errors.push(`${path}.battlefieldId must match its object key`)
    }
    if (!(typeof get(config, 'name') === 'string') || !get(config, 'name', '').trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    const rules = get(config, 'rules')
    if (!Array.isArray(rules)) {
      errors.push(`${path}.rules must be an array`)
      continue
    }
    const seenIds = new Set()
    const seenRows = new Set()
    for (const [index, rule] of enumerate(rules)) {
      const rulePath = `${path}.rules[${index}]`
      if (!isRecord(rule)) {
        errors.push(`${rulePath} must be an object`)
        continue
      }
      const ruleId = get(rule, 'id')
      if (!(typeof ruleId === 'string') || !ruleId.trim()) {
        errors.push(`${rulePath}.id must be a non-empty string`)
      } else if (contains(seenIds, ruleId)) {
        errors.push(`${rulePath}.id must be unique within the battlefield`)
      } else {
        seenIds.add(ruleId)
      }
      const startRow = get(rule, 'startRow')
      if (!hasValue(isFiniteNumber(startRow)) || startRow < 1 || Math.trunc(startRow) !== startRow) {
        errors.push(`${rulePath}.startRow must be a positive integer`)
      } else if (contains(seenRows, Math.trunc(startRow))) {
        errors.push(`${rulePath}.startRow must be unique within the battlefield`)
      } else {
        seenRows.add(Math.trunc(startRow))
      }
      if (!(typeof get(rule, 'monsterStripePresetKey') === 'string') || !get(rule, 'monsterStripePresetKey', '').trim()) {
        errors.push(`${rulePath}.monsterStripePresetKey must be a non-empty string`)
      }
    }
  }
  return errors
}

export function validateModelAssetProfilePayload(payload) {
  let path
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  function validateVector3(value, path, nonNegative = false) {
    if (!isRecord(value)) {
      errors.push(`${path} must be an object`)
      return
    }
    for (const axis of ['x', 'y', 'z']) {
      const component = get(value, axis)
      if (!hasValue(isFiniteNumber(component))) {
        errors.push(`${path}.${axis} must be a finite number`)
      } else if (hasValue(nonNegative) && component < 0) {
        errors.push(`${path}.${axis} must be zero or greater`)
      }
    }
  }
  for (const [key, profile] of Object.entries(payload)) {
    path = `root[${key}]`
    if (!(typeof key === 'string') || !key.startsWith('/')) {
      errors.push('model asset profile keys must be absolute public paths beginning with /')
      continue
    }
    if (!isRecord(profile)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(profile, 'modelPath') !== key) {
      errors.push(`${path}.modelPath must match its object key`)
    }
    const scale = get(profile, 'uniformScale')
    if (!hasValue(isFiniteNumber(scale)) || scale <= 0 || scale > 1000000) {
      errors.push(`${path}.uniformScale must be greater than zero and no more than 1000000`)
    }
    validateVector3(get(profile, 'rotationDeg'), `${path}.rotationDeg`)
    validateVector3(get(profile, 'positionOffset'), `${path}.positionOffset`)
    if (!['source', 'depth-safe-cutout'].includes(get(profile, 'transparencyPolicy'))) {
      errors.push(`${path}.transparencyPolicy is invalid`)
    }
    const bounds = get(profile, 'measuredBounds')
    if (bounds !== null) {
      if (!isRecord(bounds)) {
        errors.push(`${path}.measuredBounds must be an object`)
      } else {
        validateVector3(get(bounds, 'size'), `${path}.measuredBounds.size`, true)
        validateVector3(get(bounds, 'center'), `${path}.measuredBounds.center`)
      }
    }
  }
  return errors
}

export function validateMonsterMovementConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  if (!hasValue(payload)) {
    return ['at least one movement preset is required']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('movement preset key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(config, 'name') === 'string') || !config.name.trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    if (!(typeof get(config, 'modeId') === 'string') || !config.modeId.trim()) {
      errors.push(`${path}.modeId must be a non-empty string`)
    }
    const parameters = get(config, 'parameters')
    if (!isRecord(parameters)) {
      errors.push(`${path}.parameters must be an object`)
      continue
    }
    for (const [parameterKey, value] of Object.entries(parameters)) {
      const parameterPath = `${path}.parameters[${parameterKey}]`
      if (!(typeof parameterKey === 'string') || !parameterKey.trim()) {
        errors.push(`${path}.parameters keys must be non-empty strings`)
      } else if (!(typeof value === 'string' || Number.isInteger(value) || typeof value === 'number' || typeof value === 'boolean') || !(typeof value === 'boolean') && !(typeof value === 'string') && !hasValue(isFiniteNumber(value))) {
        errors.push(`${parameterPath} must be a finite number, string, or boolean`)
      }
    }
    const duration = get(parameters, 'duration')
    if (!hasValue(isFiniteNumber(duration)) || duration <= 0) {
      errors.push(`${path}.parameters.duration must be greater than zero`)
    }
  }
  return errors
}

export function validateMonsterAttackConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  if (!hasValue(payload)) {
    return ['at least one attack preset is required']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('attack preset key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(config, 'name') === 'string') || !config.name.trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    if (!(typeof get(config, 'modeId') === 'string') || !config.modeId.trim()) {
      errors.push(`${path}.modeId must be a non-empty string`)
    }
    const parameters = get(config, 'parameters')
    if (!isRecord(parameters)) {
      errors.push(`${path}.parameters must be an object`)
      continue
    }
    for (const [parameterKey, value] of Object.entries(parameters)) {
      const parameterPath = `${path}.parameters[${parameterKey}]`
      if (!(typeof parameterKey === 'string') || !parameterKey.trim()) {
        errors.push(`${path}.parameters keys must be non-empty strings`)
      } else if (!(typeof value === 'string' || Number.isInteger(value) || typeof value === 'number' || typeof value === 'boolean') || !(typeof value === 'boolean') && !(typeof value === 'string') && !hasValue(isFiniteNumber(value))) {
        errors.push(`${parameterPath} must be a finite number, string, or boolean`)
      }
    }
    const duration = get(parameters, 'duration')
    if (!hasValue(isFiniteNumber(duration)) || duration <= 0) {
      errors.push(`${path}.parameters.duration must be greater than zero`)
    }
  }
  return errors
}

export function validateMonsterDeathConfigPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  if (!hasValue(payload)) {
    return ['at least one death preset is required']
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('death preset key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(config, 'name') === 'string') || !config.name.trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    if (!(typeof get(config, 'modeId') === 'string') || !config.modeId.trim()) {
      errors.push(`${path}.modeId must be a non-empty string`)
    }
    const parameters = get(config, 'parameters')
    if (!isRecord(parameters)) {
      errors.push(`${path}.parameters must be an object`)
      continue
    }
    for (const [parameterKey, value] of Object.entries(parameters)) {
      const parameterPath = `${path}.parameters[${parameterKey}]`
      if (!(typeof parameterKey === 'string') || !parameterKey.trim()) {
        errors.push(`${path}.parameters keys must be non-empty strings`)
      } else if (!(typeof value === 'string' || Number.isInteger(value) || typeof value === 'number' || typeof value === 'boolean') || !(typeof value === 'boolean') && !(typeof value === 'string') && !hasValue(isFiniteNumber(value))) {
        errors.push(`${parameterPath} must be a finite number, string, or boolean`)
      }
    }
    const duration = get(parameters, 'duration')
    if (!hasValue(isFiniteNumber(duration)) || duration <= 0) {
      errors.push(`${path}.parameters.duration must be greater than zero`)
    }
  }
  return errors
}

export function validateSpriteAshPresetPayload(payload) {
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  if (!hasValue(payload)) {
    return ['at least one sprite ash preset is required']
  }
  const numericFields = ['duration', 'progressPower', 'startHold', 'endFade', 'fieldInvert', 'fieldContrast', 'fieldOffset', 'directionalStrength', 'directionAngleDeg', 'radialStrength', 'radialDirection', 'centerX', 'centerY', 'radialScaleX', 'radialScaleY', 'radialRotationDeg', 'radialPower', 'radialNoiseStrength', 'radialNoiseScale', 'crystalStrength', 'crystalScale', 'crystalSharpness', 'crystalAspect', 'crystalRotationDeg', 'crystalCrackWidth', 'crystalJitter', 'crystalBranchStrength', 'crystalBranchScale', 'spiralStrength', 'spiralTurns', 'spiralSpeed', 'spiralDirection', 'spiralRadialFrequency', 'voidPullStrength', 'voidPullRadius', 'voidPullFalloff', 'voidPullPower', 'noiseScale', 'noiseStrength', 'noiseSpeed', 'noiseDetail', 'noiseRoughness', 'noiseAspect', 'noiseRotationDeg', 'noiseFlowAngleDeg', 'warpStrength', 'warpScale', 'warpSpeed', 'edgeWidth', 'edgeSoftness', 'edgeIntensity', 'edgeInnerWidth', 'edgeOuterWidth', 'edgeFalloffPower', 'edgeNoiseStrength', 'edgeNoiseScale', 'edgePulseStrength', 'edgePulseSpeed', 'charStrength', 'ashTrail', 'residueWidth', 'residueOpacity', 'residueDensity', 'residueNoiseScale', 'residueDecayPower', 'residueFadeStart', 'residueGlow', 'vertexDeformStrength', 'vertexBendX', 'vertexBendY', 'vertexTwist', 'vertexBulge', 'vertexDepth', 'vertexWaveStrength', 'vertexWaveScale', 'vertexWaveSpeed', 'vertexAnchorY', 'vertexSubdivisions', 'particleRate', 'particleStartProgress', 'particleEndProgress', 'particleRatePower', 'particleLifeMin', 'particleLifeMax', 'particlePowerMin', 'particlePowerMax', 'particleSizeMin', 'particleSizeMax', 'particleGravityX', 'particleGravityY', 'particleGravityZ', 'particleAngularSpeedMin', 'particleAngularSpeedMax', 'ashDensity', 'ashOpacity', 'rise', 'driftX', 'turbulence', 'flickerSpeed', 'seed', 'alphaCutoff']
  const colorFields = ['edgeColor', 'edgeInnerColor', 'edgeOuterColor', 'residueColor', 'charColor', 'ashColor']
  for (const [key, preset] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('sprite ash preset key must be a non-empty string')
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(preset, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    if (!(typeof get(preset, 'name') === 'string') || !preset.name.trim()) {
      errors.push(`${path}.name must be a non-empty string`)
    }
    if (!['none', 'ash', 'blackShards', 'embers', 'pixel'].includes(get(preset, 'particleMode'))) {
      errors.push(`${path}.particleMode is invalid`)
    }
    if (!['weighted', 'add', 'max', 'min', 'multiply'].includes(get(preset, 'fieldBlendMode'))) {
      errors.push(`${path}.fieldBlendMode is invalid`)
    }
    for (const field of iterable(numericFields)) {
      if (!hasValue(isFiniteNumber(get(preset, field)))) {
        errors.push(`${path}.${field} must be a finite number`)
      }
    }
    if (hasValue(isFiniteNumber(get(preset, 'duration'))) && preset.duration <= 0) {
      errors.push(`${path}.duration must be greater than zero`)
    }
    for (const field of iterable(colorFields)) {
      const value = get(preset, field)
      if (!(typeof value === 'string') || sizeOf(value) !== 7 || !value.startsWith('#')) {
        errors.push(`${path}.${field} must be a #RRGGBB color`)
      }
    }
  }
  return errors
}

export function validateMonsterStatusParticleConfigPayload(payload) {
  let value
  const errors = []
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  if (!hasValue(payload)) {
    return ['at least one monster status particle preset is required']
  }
  function isVector3(value) {
    return isRecord(value) && ['x', 'y', 'z'].every((axis) => hasValue(isFiniteNumber(get(value, axis))))
  }
  for (const [key, config] of Object.entries(payload)) {
    const path = `root[${key}]`
    if (!(typeof key === 'string') || !key.trim()) {
      errors.push('status particle preset key must be a non-empty string')
      continue
    }
    if (!isRecord(config)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (get(config, 'presetKey') !== key) {
      errors.push(`${path}.presetKey must match its object key`)
    }
    for (const field of ['name', 'particlePresetKey', 'motionModeId']) {
      if (!(typeof get(config, field) === 'string') || !config[field].trim()) {
        errors.push(`${path}.${field} must be a non-empty string`)
      }
    }
    if (!['feet', 'body', 'head', 'world'].includes(get(config, 'anchor'))) {
      errors.push(`${path}.anchor must be feet, body, head, or world`)
    }
    if (!(typeof get(config, 'followMonster') === 'boolean')) {
      errors.push(`${path}.followMonster must be a boolean`)
    }
    if (!hasValue(isVector3(get(config, 'offset')))) {
      errors.push(`${path}.offset must be a finite vector3`)
    }
    const parameters = get(config, 'motionParameters')
    if (!isRecord(parameters)) {
      errors.push(`${path}.motionParameters must be an object`)
    } else {
      for (const [parameterKey, valueEntry] of Object.entries(parameters)) {
        value = valueEntry
        if (!(typeof parameterKey === 'string') || !parameterKey.trim()) {
          errors.push(`${path}.motionParameters keys must be non-empty strings`)
        } else if (!(typeof value === 'string' || typeof value === 'boolean') && !hasValue(isFiniteNumber(value)) && !hasValue(isVector3(value))) {
          errors.push(`${path}.motionParameters[${parameterKey}] must be a finite number, string, boolean, or vector3`)
        }
      }
    }
    for (const field of ['capacity', 'activeCount']) {
      value = get(config, field)
      const minimum = field === 'capacity' ? 1 : 0
      if (!Number.isInteger(value) || typeof value === 'boolean' || value < minimum) {
        const qualifier = field === 'capacity' ? 'positive' : 'non-negative'
        errors.push(`${path}.${field} must be a ${qualifier} integer`)
      }
    }
    for (const field of ['timeScale', 'sizeScale', 'fieldRadius']) {
      value = get(config, field)
      if (!hasValue(isFiniteNumber(value)) || value <= 0) {
        errors.push(`${path}.${field} must be greater than zero`)
      }
    }
    const seed = get(config, 'seed')
    if (!Number.isInteger(seed) || typeof seed === 'boolean') {
      errors.push(`${path}.seed must be an integer`)
    }
    const duration = get(config, 'durationSec')
    if (!hasValue(isFiniteNumber(duration)) || duration < 0) {
      errors.push(`${path}.durationSec must be zero or greater`)
    }
  }
  return errors
}
