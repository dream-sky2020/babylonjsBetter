import { contains, get, hasValue, isRecord, iterable, sameMembers, sizeOf, toSet } from './jsonValues.mjs'

function number(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateValue(value) {
  let item
  if (!isRecord(value)) {
    return ['value must be an object']
  }
  if (get(value, 'type') === 'literal') {
    item = get(value, 'value')
    return contains(value, 'value') && (item === null || (typeof item === 'string' || typeof item === 'boolean') || hasValue(number(item))) ? [] : ['literal must be a finite scalar']
  }
  if (get(value, 'type') === 'memory') {
    return typeof get(value, 'key') === 'string' && Array.isArray(get(value, 'path')) && value.path.every((item) => typeof item === 'string') ? [] : ['memory reference shape is invalid']
  }
  return ['unsupported value type']
}

export function validateCondition(value, depth = 0) {
  if (depth > 32 || !isRecord(value)) {
    return ['condition shape or depth is invalid']
  }
  const kind = get(value, 'type')
  if (['all', 'any'].includes(kind) && Array.isArray(get(value, 'conditions'))) {
    if (hasValue(depth) || value.conditions.some((child) => !isRecord(child) || get(child, 'type') !== 'compare')) {
      return ['conditions must be flat comparisons']
    }
    return value.conditions.flatMap((child) => validateCondition(child, depth + 1))
  }
  if (kind === 'compare' && ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(get(value, 'operator'))) {
    return [...validateValue(get(value, 'left')), ...validateValue(get(value, 'right'))]
  }
  return ['unsupported condition shape']
}

export function validateEvent(value) {
  if (!isRecord(value) || get(value, 'type') !== 'event' || !(typeof get(value, 'eventType') === 'string') || !hasValue(number(get(value, 'version')))) {
    return ['event shape is invalid']
  }
  const payload = get(value, 'payload', {})
  if (!isRecord(payload)) {
    return ['payload must be an object']
  }
  if (contains(value, 'correlationId') && !(typeof value.correlationId === 'string')) {
    return ['event correlationId must be a string']
  }
  return Object.values(payload).flatMap((item) => validateValue(item))
}

export function validateWait(value) {
  if (!isRecord(value) || !Array.isArray(get(value, 'filters'))) {
    return ['wait filters must be an array']
  }
  const errors = []
  for (const item of value.filters) {
    if (!isRecord(item) || !(typeof get(item, 'field') === 'string') || !['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(get(item, 'operator'))) {
      errors.push('event filter shape is invalid')
    } else {
      errors.push(...validateValue(get(item, 'value')))
    }
  }
  if (['sourceModuleId', 'correlationId'].some((field) => contains(value, field) && !(typeof value[field] === 'string'))) {
    errors.push('wait source and correlation ID must be strings')
  }
  if (contains(value, 'timeoutMs') && (!Number.isInteger(value.timeoutMs) || (0 > value.timeoutMs || value.timeoutMs > 2147483647))) {
    errors.push('wait timeoutMs is invalid')
  }
  if (contains(value, 'allowMovement') && !(typeof value.allowMovement === 'boolean')) {
    errors.push('wait allowMovement must be boolean')
  }
  return errors
}

export function validateAction(value) {
  if (!isRecord(value) || !['message', 'visual-state', 'shared-variable', 'service'].includes(get(value, 'type'))) {
    return ['map action shape is invalid']
  }
  const kind = value.type
  const strings = {message: ['text'], ['visual-state']: ['targetEntityId', 'stateId', 'groupId', 'feedback'], ['shared-variable']: ['variableId'], service: ['commandId', 'successMessage']}
  const errors = []
  if (strings[kind].some((key) => contains(value, key) && (!(typeof value[key] === 'string') || sizeOf(value[key]) > 256))) {
    errors.push('map action text fields are invalid')
  }
  if (kind === 'service' && contains(value, 'parameters') && !isRecord(value.parameters)) {
    errors.push('map service parameters must be an object')
  }
  const commandId = get(value, 'commandId')
  if (kind === 'service' && typeof commandId === 'string' && hasValue(commandId) && (sizeOf(commandId) > 128 || !/^(?:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+)$(?![\s\S])/.test(commandId))) {
    errors.push('map service operation ID is invalid')
  }
  if (kind === 'visual-state' && !['set', 'next', 'previous', 'random', 'shuffle'].includes(get(value, 'operation', 'set'))) {
    errors.push('map visual state operation is invalid')
  }
  if (kind === 'message' && contains(value, 'durationSeconds') && (!hasValue(number(value.durationSeconds)) || (0.5 > value.durationSeconds || value.durationSeconds > 15))) {
    errors.push('map message duration is invalid')
  }
  if (kind === 'shared-variable') {
    const variableId = get(value, 'variableId')
    if (typeof variableId === 'string' && hasValue(variableId) && !/^(?:[a-z][a-z0-9_-]{0,63})$(?![\s\S])/.test(variableId)) {
      errors.push('map variable ID is invalid')
    }
    if (!['set', 'add', 'toggle', 'reset'].includes(get(value, 'variableOperation', 'set'))) {
      errors.push('map variable operation is invalid')
    }
    if (contains(value, 'value')) {
      const item = value.value
      const integer = number(item) && Math.abs(item) <= 9007199254740991 && item === Math.trunc(item)
      if (!hasValue(integer) && (get(value, 'variableOperation') === 'add' || !(typeof item === 'boolean') && (!(typeof item === 'string') || sizeOf(item) > 256))) {
        errors.push('map variable value is invalid')
      }
    }
  }
  return errors
}

export function validateDocument(presetKey, preset) {
  let item
  if (!isRecord(preset) || ![5, 6].includes(get(preset, 'schemaVersion')) || get(preset, 'presetKey') !== presetKey) {
    return [`${presetKey}: V5 or V6 identity is required`]
  }
  const legacy = preset.schemaVersion === 5
  const kinds = hasValue(legacy) ? ['condition', 'choice', 'event'] : ['condition', 'choice', 'event', 'action']
  const branches = hasValue(legacy) ? ['next', 'true', 'false', 'choice'] : ['next', 'true', 'false', 'choice', 'timeout']
  const errors = []
  if (!(typeof get(preset, 'name') === 'string') || !preset.name.trim()) {
    errors.push('name is required')
  }
  const bindings = get(preset, 'textVariables', {})
  if (!isRecord(bindings)) {
    errors.push('textVariables must be an object')
  } else {
    for (const [name, binding] of Object.entries(bindings)) {
      if (!(typeof name === 'string') || (1 > sizeOf(name) || sizeOf(name) > 64) || [...name].some((ch) => !/^[\p{L}\p{N}]+$/u.test(ch) && !'_-'.includes(ch))) {
        errors.push(`${name}: invalid text variable name`)
      }
      if (!isRecord(binding) || !(typeof get(binding, 'key') === 'string') || !Array.isArray(get(binding, 'path')) || !binding.path.every((part) => typeof part === 'string')) {
        errors.push(`${name}: invalid text variable binding`)
      }
    }
  }
  const graph = get(preset, 'graph')
  if (!isRecord(graph) || !isRecord(get(graph, 'nodes')) || !isRecord(get(graph, 'edges'))) {
    return errors + ['graph.nodes and graph.edges must be objects']
  }
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (!isRecord(node) || get(node, 'id') !== nodeId || !nodeId.trim() || !contains(kinds, get(node, 'kind')) || !(typeof get(node, 'title') === 'string')) {
      errors.push(`${nodeId}: node identity is invalid`)
      continue
    }
    const [position, display] = [get(node, 'position'), get(node, 'display')]
    if (!isRecord(position) || !['x', 'y'].every((axis) => hasValue(number(get(position, axis))))) {
      errors.push(`${nodeId}: position is invalid`)
    }
    if (!isRecord(display) || !['rectangle', 'rounded', 'diamond', 'hexagon', 'pill', 'document'].includes(get(display, 'shape')) || !(typeof get(display, 'colorToken') === 'string')) {
      errors.push(`${nodeId}: display is invalid`)
    } else if (!Number.isInteger(get(display, 'widthUnits')) || !Number.isInteger(get(display, 'heightUnits')) || (4 > display.widthUnits || display.widthUnits > 40) || (3 > display.heightUnits || display.heightUnits > 40)) {
      errors.push(`${nodeId}: display size is invalid`)
    }
    if (isRecord(display) && contains(display, 'whitespace')) {
      const whitespace = display.whitespace
      if (!isRecord(whitespace) || Object.entries(whitespace).some(([key, value]) => !['header', 'content', 'outputs', 'top', 'sections', 'bottom', 'height'].includes(key) || !(typeof value === 'boolean'))) {
        errors.push(`${nodeId}: whitespace settings are invalid`)
      }
    }
    for (const [name, orderName] of [['lines', 'lineOrder'], ['inputs', 'inputOrder'], ['outputs', 'outputOrder']]) {
      const [items, order] = [get(node, name), get(node, orderName)]
      if (!isRecord(items) || !Array.isArray(order) || !order.every((item) => typeof item === 'string')) {
        errors.push(`${nodeId}: ${name} collection is invalid`)
        continue
      }
      if (sizeOf(toSet(order)) !== sizeOf(order) || !sameMembers(toSet(order), toSet(items))) {
        errors.push(`${nodeId}: ${name} order is invalid`)
      }
      for (const [itemId, itemEntry] of Object.entries(items)) {
        item = itemEntry
        if (!isRecord(item) || get(item, 'id') !== itemId) {
          errors.push(`${nodeId}: ${name} id is invalid`)
          continue
        }
        if (name === 'lines' && !['speaker', 'text'].every((field) => typeof get(item, field) === 'string')) {
          errors.push(`${nodeId}: line shape is invalid`)
        }
        if (name === 'outputs' && !contains(branches, get(item, 'branch'))) {
          errors.push(`${nodeId}: branch shape is invalid`)
        }
        if (name !== 'lines' && contains(item, 'label') && !(typeof item.label === 'string')) {
          errors.push(`${nodeId}: port label is invalid`)
        }
      }
    }
    if (!isRecord(get(node, 'inputs')) || sizeOf(node.inputs) !== 1 || !Array.isArray(get(node, 'inputOrder')) || sizeOf(node.inputOrder) !== 1) {
      errors.push(`${nodeId}: node requires exactly one input`)
    }
    if (node.kind === 'condition') {
      if (contains(node, 'formula') && (!(typeof node.formula === 'string') || contains(node, 'condition'))) {
        errors.push(`${nodeId}: condition formula must be a string and the only condition format`)
      }
      if (contains(node, 'condition')) {
        errors.push(...validateCondition(node.condition))
      }
    }
    if (node.kind === 'condition') {
      const outputs = get(node, 'outputs', {})
      function fixedOutput(branch, label) {
        const item = get(outputs, `port:${nodeId}:output:${branch}`)
        return isRecord(item) && get(item, 'branch') === branch && get(item, 'label') === label
      }
      if (!isRecord(outputs) || sizeOf(outputs) !== 2 || [['true', '成立'], ['false', '不成立']].some(([branch, label]) => !hasValue(fixedOutput(branch, label)))) {
        errors.push(`${nodeId}: condition requires fixed true/false outputs`)
      }
    }
    if (node.kind === 'event') {
      if (!['send', 'wait'].includes(get(node, 'mode'))) {
        errors.push(`${nodeId}: event mode is invalid`)
      }
      const events = get(node, 'events')
      if (!Array.isArray(events) || !hasValue(events) || get(node, 'mode') === 'wait' && sizeOf(events) !== 1) {
        errors.push(`${nodeId}: wait requires one event; send requires at least one event`)
      } else {
        for (const event of iterable(events)) {
          errors.push(...validateEvent(event))
          if (!hasValue(legacy) && get(node, 'mode') === 'wait' && isRecord(event) && (contains(event, 'payload') || contains(event, 'correlationId'))) {
            errors.push(`${nodeId}: wait criteria belong in wait, not the event reference`)
          }
        }
      }
      if (!hasValue(legacy) && get(node, 'mode') === 'wait') {
        errors.push(...validateWait(get(node, 'wait')))
      }
    }
    if (node.kind === 'action' && contains(node, 'action')) {
      errors.push(...validateAction(node.action))
    }
  }
  const occupiedOutputs = new Set()
  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    if (!isRecord(edge) || get(edge, 'id') !== edgeId || !edgeId.trim()) {
      errors.push(`${edgeId}: edge identity is invalid`)
      continue
    }
    for (const endpoint of ['from', 'to']) {
      item = get(edge, endpoint)
      if (!isRecord(item) || !['nodeId', 'portId'].every((field) => typeof get(item, field) === 'string')) {
        errors.push(`${edgeId}: endpoint shape is invalid`)
      }
    }
    const [start, end] = [get(edge, 'from'), get(edge, 'to')]
    if (isRecord(start) && isRecord(end) && typeof get(start, 'nodeId') === 'string' && start.nodeId === get(end, 'nodeId')) {
      errors.push(`${edgeId}: node output cannot connect to its own input`)
    }
    if (isRecord(start) && ['nodeId', 'portId'].every((field) => typeof get(start, field) === 'string')) {
      const output = [start.nodeId, start.portId]
      if (contains(occupiedOutputs, output)) {
        errors.push(`${edgeId}: output port may have only one connection`)
      }
      occupiedOutputs.add(output)
    }
  }
  return errors
}
