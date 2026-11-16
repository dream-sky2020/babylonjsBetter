import { isFiniteNumber, validateExclamationMarkPresetPayload } from './presets.mjs'
import { validateDocument } from './dialogueRules.mjs'
import { contains, get, hasValue, isRecord, iterable, sizeOf } from './jsonValues.mjs'

function validateExclamationProgress(progress, path, errors) {
  if (!isRecord(progress)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (!(typeof get(progress, 'enabled') === 'boolean')) {
    errors.push(`${path}.enabled must be a boolean`)
  }
  const value = get(progress, 'progress')
  if (!hasValue(isFiniteNumber(value)) || (0 > value || value > 1)) {
    errors.push(`${path}.progress must be between 0 and 1`)
  }
  if (!['none', 'linear', 'radial', 'sector', 'ring', 'diamond', 'box', 'rect-perimeter'].includes(get(progress, 'shape'))) {
    errors.push(`${path}.shape is invalid`)
  }
  if (!['forward', 'reverse', 'center-out', 'edges-in'].includes(get(progress, 'direction'))) {
    errors.push(`${path}.direction is invalid`)
  }
  for (const field of ['angleDeg', 'startAngleDeg', 'sweepAngleDeg', 'innerRadius', 'outerRadius', 'softness']) {
    if (contains(progress, field) && !hasValue(isFiniteNumber(get(progress, field)))) {
      errors.push(`${path}.${field} must be a finite number`)
    }
  }
  for (const field of ['centerOffsetPx', 'axisScale']) {
    if (!contains(progress, field)) {
      continue
    }
    const vector = get(progress, field)
    if (!isRecord(vector) || !hasValue(isFiniteNumber(get(vector, 'x'))) || !hasValue(isFiniteNumber(get(vector, 'y')))) {
      errors.push(`${path}.${field} must contain finite x and y numbers`)
    }
  }
  for (const field of ['filled', 'unfilled']) {
    const style = get(progress, field)
    if (!isRecord(style)) {
      errors.push(`${path}.${field} must be an object`)
      continue
    }
    if (!['color', 'texture'].includes(get(style, 'source'))) {
      errors.push(`${path}.${field}.source must be color or texture`)
    }
    if (!(typeof get(style, 'color') === 'string')) {
      errors.push(`${path}.${field}.color must be a string`)
    }
    const opacity = get(style, 'opacity')
    if (!hasValue(isFiniteNumber(opacity)) || (0 > opacity || opacity > 1)) {
      errors.push(`${path}.${field}.opacity must be between 0 and 1`)
    }
  }
}

export function validateCurrentExclamationMarks(payload) {
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  const errors = []
  for (const [key, preset] of Object.entries(payload)) {
    const path = `root[${key}]`
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
    if (!(typeof get(preset, 'imagePath') === 'string')) {
      errors.push(`${path}.imagePath must be a string`)
    }
    if (!['fixed', 'preserve-aspect'].includes(get(preset, 'sizeMode', 'preserve-aspect'))) {
      errors.push(`${path}.sizeMode is invalid`)
    }
    for (const field of ['width', 'height', 'scale', 'scaleX', 'scaleY']) {
      if (contains(preset, field) && (!hasValue(isFiniteNumber(get(preset, field))) || preset[field] <= 0)) {
        errors.push(`${path}.${field} must be greater than 0`)
      }
    }
    const position = get(preset, 'position')
    if (!Array.isArray(position) || sizeOf(position) !== 3 || position.some((item) => !hasValue(isFiniteNumber(item)))) {
      errors.push(`${path}.position must contain three finite numbers`)
    }
    if (!(typeof get(preset, 'faceCamera') === 'boolean')) {
      errors.push(`${path}.faceCamera must be a boolean`)
    }
    if (contains(preset, 'progress')) {
      validateExclamationProgress(get(preset, 'progress'), `${path}.progress`, errors)
    } else {
      errors.push(...validateExclamationMarkPresetPayload({[key]: preset}))
    }
  }
  return errors
}

export function validateCurrentExclamationBases(payload) {
  if (!isRecord(payload)) {
    return ['body must be a JSON object']
  }
  const errors = []
  for (const [key, preset] of Object.entries(payload)) {
    const path = `root[${key}]`
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
    if (!(typeof get(preset, 'enabled') === 'boolean')) {
      errors.push(`${path}.enabled must be a boolean`)
    }
    if (!(typeof get(preset, 'imagePath') === 'string')) {
      errors.push(`${path}.imagePath must be a string`)
    }
    if (!['fixed', 'preserve-aspect'].includes(get(preset, 'sizeMode'))) {
      errors.push(`${path}.sizeMode is invalid`)
    }
    for (const field of ['width', 'height', 'scale', 'scaleX', 'scaleY']) {
      if (!hasValue(isFiniteNumber(get(preset, field))) || preset[field] <= 0) {
        errors.push(`${path}.${field} must be greater than 0`)
      }
    }
    const offset = get(preset, 'offset')
    if (!Array.isArray(offset) || sizeOf(offset) !== 3 || offset.some((item) => !hasValue(isFiniteNumber(item)))) {
      errors.push(`${path}.offset must contain three finite numbers`)
    }
    validateExclamationProgress(get(preset, 'progress'), `${path}.progress`, errors)
  }
  return errors
}

export function dungeonMapPresetFileName(presetKey) {
  if (!/^(?:[A-Za-z0-9_-]+)$(?![\s\S])/.test(presetKey)) {
    throw new Error(`dungeon map preset key "${presetKey}" is not storage-safe`)
  }
  return `${presetKey}.json`
}

export function dialogueMapPresetFileName(presetKey) {
  if (!/^(?:[A-Za-z0-9_-]+)$(?![\s\S])/.test(presetKey)) {
    throw new Error(`dialogue map preset key "${presetKey}" is not storage-safe`)
  }
  return `${presetKey}.json`
}

export function validateDialogueMapLibrary(payload) {
  if (!isRecord(payload)) {
    return ['dialogue map preset library must be an object']
  }
  const errors = []
  for (const [presetKey, preset] of Object.entries(payload)) {
    try {
      dialogueMapPresetFileName(presetKey)
    } catch (exc) {
      errors.push(exc.message)
      continue
    }
    errors.push(...validateDocument(presetKey, preset).map((error) => `${presetKey}: ${error}`))
  }
  return errors
}

export function dialoguePreviewPresetFileName(presetKey) {
  if (!(typeof presetKey === 'string') || !/^(?:[A-Za-z0-9_-]+)$(?![\s\S])/.test(presetKey)) {
    throw new Error('dialogue preview preset key is invalid')
  }
  return `${presetKey}.json`
}

export function validateDialoguePreviewLibrary(payload) {
  let nodeId
  const errors = []
  if (!isRecord(payload) || !hasValue(payload)) {
    return ['dialogue preview preset library must be a non-empty object']
  }
  for (const [presetKey, preset] of Object.entries(payload)) {
    try {
      dialoguePreviewPresetFileName(presetKey)
    } catch (exc) {
      errors.push(exc.message)
      continue
    }
    if (!isRecord(preset) || get(preset, 'presetKey') !== presetKey || ![1, 2].includes(get(preset, 'schemaVersion'))) {
      errors.push(`${presetKey}: identity or schemaVersion is invalid`)
      continue
    }
    if (!(typeof get(preset, 'name') === 'string') || !preset.name.trim()) {
      errors.push(`${presetKey}: name is required`)
    }
    const canvas = get(preset, 'canvas')
    if (!isRecord(canvas) || !['width', 'height', 'gridSize'].every((field) => hasValue(isFiniteNumber(get(canvas, field))))) {
      errors.push(`${presetKey}: canvas geometry is invalid`)
    }
    if (get(preset, 'schemaVersion') === 2) {
      const nodes = get(preset, 'nodes')
      const rootIds = get(preset, 'rootIds')
      if (!isRecord(nodes) || !Array.isArray(rootIds) || rootIds.some((nodeId) => !(typeof nodeId === 'string'))) {
        errors.push(`${presetKey}: V2 nodes or rootIds is invalid`)
        continue
      }
      for (const [nodeIdEntry, node] of Object.entries(nodes)) {
        nodeId = nodeIdEntry
        if (!(typeof nodeId === 'string') || !nodeId.trim() || !isRecord(node) || get(node, 'id') !== nodeId) {
          errors.push(`${presetKey}: node id is invalid`)
          continue
        }
        if (!(typeof get(node, 'type') === 'string') || !node.type.trim()) {
          errors.push(`${presetKey}/${nodeId}: type is required`)
        }
        const layout = get(node, 'layout')
        const absoluteLayout = isRecord(layout) && get(layout, 'mode') === 'absolute' && ['x', 'y', 'width', 'height', 'zIndex'].every((field) => hasValue(isFiniteNumber(get(layout, field))))
        const rectLayout = isRecord(layout) && get(layout, 'mode') === 'rect-transform' && isFiniteNumber(get(layout, 'zIndex')) && ['parent', 'safe-area'].includes(get(layout, 'relativeTo')) && ['anchorMin', 'anchorMax', 'pivot', 'anchoredPosition', 'sizeDelta'].every((field) => isRecord(get(layout, field)) && ['x', 'y'].every((axis) => hasValue(isFiniteNumber(get(layout[field], axis)))))
        if (!hasValue(absoluteLayout) && !hasValue(rectLayout)) {
          errors.push(`${presetKey}/${nodeId}: layout is invalid`)
        }
        if (!hasValue(isFiniteNumber(get(node, 'opacity'))) || !isRecord(get(node, 'props')) || !Array.isArray(get(node, 'childIds'))) {
          errors.push(`${presetKey}/${nodeId}: node properties are invalid`)
        }
        const parentId = get(node, 'parentId')
        if (parentId !== null && !contains(nodes, parentId)) {
          errors.push(`${presetKey}/${nodeId}: parent does not exist`)
        }
        for (const childId of get(node, 'childIds', [])) {
          if (!contains(nodes, childId) || get(nodes[childId], 'parentId') !== nodeId) {
            errors.push(`${presetKey}/${nodeId}: child relationship is invalid`)
          }
        }
      }
      for (const rootId of iterable(rootIds)) {
        if (!contains(nodes, rootId) || get(nodes[rootId], 'parentId') !== null) {
          errors.push(`${presetKey}: root node is invalid: ${rootId}`)
        }
      }
      continue
    }
    const components = get(preset, 'components')
    if (!Array.isArray(components)) {
      errors.push(`${presetKey}: components must be an array`)
      continue
    }
    const ids = new Set()
    for (const component of iterable(components)) {
      const componentId = isRecord(component) ? get(component, 'id') : null
      if (!(typeof componentId === 'string') || !componentId.trim() || contains(ids, componentId)) {
        errors.push(`${presetKey}: component id is missing or duplicated`)
        continue
      }
      ids.add(componentId)
      if (!(typeof get(component, 'kind') === 'string') || !component.kind.trim()) {
        errors.push(`${presetKey}/${componentId}: kind is invalid`)
      }
      if (!['x', 'y', 'width', 'height', 'zIndex', 'opacity'].every((field) => hasValue(isFiniteNumber(get(component, field))))) {
        errors.push(`${presetKey}/${componentId}: geometry is invalid`)
      }
      const style = get(component, 'style')
      if (!isRecord(style) || !['strokeWidth', 'cornerRadius', 'fontSize'].every((field) => hasValue(isFiniteNumber(get(style, field))))) {
        errors.push(`${presetKey}/${componentId}: style is invalid`)
      }
    }
  }
  return errors
}
