import { contains, enumerate, get, hasValue, isRecord, iterable, sizeOf, toSet } from './jsonValues.mjs'

export function validateVisualComponents(tables, owners, path) {
  let kind
  let entityId
  let names
  let entries
  let validObject
  const errors = []
  const [objects, states] = [{}, {}]
  function validId(value) {
    return typeof value === 'string' && hasValue(/^(?:[A-Za-z0-9][A-Za-z0-9_.-]{0,95})$(?![\s\S])/.test(value)) && !['constructor', 'prototype'].includes(value)
  }
  function number(value) {
    return typeof value === 'number' && Number.isFinite(value)
  }
  function color(value) {
    return typeof value === 'string' && hasValue(/^(?:#[a-fA-F0-9]{6})$(?![\s\S])/.test(value))
  }
  for (const [kindEntry, byOwner] of [['visual-objects', objects], ['visual-state', states]]) {
    kind = kindEntry
    const rows = get(tables, kind, [])
    if (!Array.isArray(rows)) {
      errors.push(`${path}.components.${kind} must be an array`)
      continue
    }
    for (const row of iterable(rows)) {
      entityId = isRecord(row) ? get(row, 'entityId') : null
      const owner = typeof entityId === 'string' ? get(owners, entityId) : null
      if (!hasValue(owner) || get(owner, 'entityType') !== 'visual-object' || contains(byOwner, entityId) || !Number.isInteger(get(row, 'version')) || row.version !== 1) {
        errors.push(`${path}.components.${kind} has an invalid owner, version or duplicate component`)
        continue
      }
      byOwner[entityId] = row
    }
  }
  for (const [entityIdEntry, row] of Object.entries(objects)) {
    entityId = entityIdEntry
    names = new Set()
    entries = get(row, 'objects')
    if (!Array.isArray(entries)) {
      errors.push(`${path}.${entityId}.objects must be an array`)
      continue
    }
    for (const entry of iterable(entries)) {
      const name = isRecord(entry) ? get(entry, 'name') : null
      if (!hasValue(validId(name)) || contains(names, name)) {
        errors.push(`${path}.${entityId} has an invalid or duplicate visual object name`)
        continue
      }
      names.add(name)
      let offset
      ;[offset, kind] = [get(entry, 'offset'), get(entry, 'kind')]
      const validOffset = Array.isArray(offset) && sizeOf(offset) === 3 && offset.map(number).every(hasValue)
      const validEnabled = !contains(entry, 'enabled') || typeof entry.enabled === 'boolean'
      if (kind === 'point-light') {
        const [intensity, distance] = [get(entry, 'intensity'), get(entry, 'range')]
        validObject = color(get(entry, 'color')) && number(intensity) && intensity >= 0 && number(distance) && distance > 0
      } else if (kind === 'sphere') {
        const diameter = get(entry, 'diameter')
        validObject = color(get(entry, 'color')) && number(diameter) && diameter > 0
      } else {
        const model = get(entry, 'modelPath')
        validObject = kind === 'model' && typeof model === 'string' && hasValue(/^(?:resources\/[^?#]+\.(glb|gltf))$(?![\s\S])/i.test(model)) && !contains(model, '\\') && model.split('/').every((part) => !['', '.', '..'].includes(part))
      }
      if (!hasValue(validOffset) || !hasValue(validEnabled) || !hasValue(validObject)) {
        errors.push(`${path}.${entityId}.${name} has invalid visual object parameters`)
      }
    }
  }
  for (const [entityIdEntry, row] of Object.entries(states)) {
    entityId = entityIdEntry
    entries = get(row, 'states')
    if (!Array.isArray(entries) || !hasValue(validId(get(row, 'initialState')))) {
      errors.push(`${path}.${entityId} requires an initial state and state list`)
      continue
    }
    const ids = new Set()
    const source = get(get(objects, entityId, {}), 'objects')
    names = Array.isArray(source) ? new Set(source.filter((item) => isRecord(item) && hasValue(validId(get(item, 'name')))).map((item) => item.name)) : new Set()
    for (const entry of iterable(entries)) {
      const stateId = isRecord(entry) ? get(entry, 'id') : null
      const enabled = isRecord(entry) ? get(entry, 'enabled') : null
      if (!hasValue(validId(stateId)) || contains(ids, stateId) || !isRecord(enabled) || Object.entries(enabled).some(([key, value]) => !hasValue(validId(key)) || !(typeof value === 'boolean'))) {
        errors.push(`${path}.${entityId} has an invalid or duplicate visual state`)
        continue
      }
      ids.add(stateId)
      if (contains(entry, 'label') && (!(typeof entry.label === 'string') || !entry.label.trim() || sizeOf(entry.label) > 80)) {
        errors.push(`${path}.${entityId}.${stateId} has an invalid display label`)
      }
      if (get(row, 'enabled') !== false && get(owners[entityId], 'enabled') !== false && Object.keys(enabled).some((key) => !contains(names, key))) {
        errors.push(`${path}.${entityId}.${stateId} refers to an unknown local object`)
      }
    }
    if (get(row, 'enabled') !== false && get(owners[entityId], 'enabled') !== false && !contains(ids, row.initialState)) {
      errors.push(`${path}.${entityId} initial visual state is missing`)
    }
    const groups = get(row, 'rotationGroups', [])
    if (!Array.isArray(groups)) {
      errors.push(`${path}.${entityId} rotationGroups must be an array`)
      continue
    }
    const groupIds = new Set()
    for (const group of iterable(groups)) {
      const groupId = isRecord(group) ? get(group, 'id') : null
      const members = isRecord(group) ? get(group, 'stateIds') : null
      if (!hasValue(validId(groupId)) || contains(groupIds, groupId) || !Array.isArray(members) || !hasValue(members) || members.some((member) => !hasValue(validId(member)) || !contains(ids, member)) || sizeOf(toSet(members)) !== sizeOf(members)) {
        errors.push(`${path}.${entityId} has an invalid rotation group or member`)
        continue
      }
      groupIds.add(groupId)
    }
  }
  return [states, errors]
}

function validVariableId(value) {
  return typeof value === 'string' && /^(?:[a-z][a-z0-9_-]{0,63})$(?![\s\S])/.test(value)
}

function validVariableValue(value, kind) {
  if (kind === 'integer') {
    return typeof value === 'number' && Math.abs(value) <= 9007199254740991 && value === Math.trunc(value)
  }
  if (kind === 'boolean') {
    return typeof value === 'boolean'
  }
  return kind === 'string' && typeof value === 'string' && sizeOf(value) <= 256
}

export function validateMapInteractions(preset, path) {
  let variableRows
  let row
  let location
  let entityId
  let variableId
  let owner
  let kind
  let facingRows
  let triggerRows
  let event
  let ownerId
  let field
  let operation
  let target
  const errors = []
  const [entities, tables] = [get(preset, 'entities'), get(preset, 'components')]
  if (!Array.isArray(entities) || !isRecord(tables)) {
    return errors
  }
  const owners = Object.fromEntries(entities.filter((row) => isRecord(row) && typeof get(row, 'id') === 'string').map((row) => [get(row, 'id'), row]))
  const [visualStates, visualErrors] = validateVisualComponents(tables, owners, path)
  errors.push(...visualErrors)
  const variables = {}
  variableRows = get(tables, 'shared-variable', [])
  if (!Array.isArray(variableRows)) {
    errors.push(`${path}.components.shared-variable must be an array`)
    variableRows = []
  }
  for (const [index, rowEntry] of enumerate(variableRows)) {
    row = rowEntry
    location = `${path}.components.shared-variable[${index}]`
    if (!isRecord(row)) {
      errors.push(`${location} must be an object`)
      continue
    }
    ;[entityId, variableId] = [get(row, 'entityId'), get(row, 'variableId')]
    owner = typeof entityId === 'string' ? get(owners, entityId, {}) : {}
    kind = get(row, 'valueType')
    if (get(owner, 'entityType') !== 'map' || !Number.isInteger(get(row, 'version')) || row.version !== 1 || !hasValue(validVariableId(variableId))) {
      errors.push(`${location} requires a valid variable ID on a map entity`)
    }
    if (!hasValue(validVariableValue(get(row, 'initialValue'), kind)) || !['lab', 'map'].includes(get(row, 'scope', 'lab'))) {
      errors.push(`${location} has an invalid initial value, type or scope`)
    }
    if (contains(row, 'label') && (!(typeof row.label === 'string') || !row.label.trim() || sizeOf(row.label) > 80)) {
      errors.push(`${location}.label is invalid`)
    }
    if (hasValue(validVariableId(variableId)) && get(row, 'enabled') !== false && get(owner, 'enabled') !== false) {
      if (contains(variables, variableId)) {
        errors.push(`${location} has a duplicate variable ID`)
      }
      variables[variableId] = kind
    }
  }
  const events = get(tables, 'event', [])
  const attachments = get(tables, 'spatial-attachment', [])
  if (!Array.isArray(events) || !Array.isArray(attachments)) {
    return errors
  }
  const allowed = new Set(['tile', 'tile-edge', 'shared-edge', 'dungeon-agent', 'spatial-object', 'obstacle', 'interaction-point'])
  function text(value) {
    return typeof value === 'string' && hasValue(value.trim()) && sizeOf(value) <= 256
  }
  const facingOwners = new Set()
  facingRows = get(tables, 'grid-facing', [])
  if (!Array.isArray(facingRows)) {
    errors.push(`${path}.components.grid-facing must be an array`)
    facingRows = []
  }
  for (row of iterable(facingRows)) {
    entityId = isRecord(row) ? get(row, 'entityId') : null
    owner = typeof entityId === 'string' ? get(owners, entityId) : null
    if (!hasValue(owner) || !['interaction-point', 'tile', 'tile-edge', 'shared-edge'].includes(get(owner, 'entityType')) || contains(facingOwners, entityId) || !Number.isInteger(get(row, 'version')) || row.version !== 1 || !['north', 'east', 'south', 'west'].includes(get(row, 'facing'))) {
      errors.push(`${path}.components.grid-facing has invalid or duplicate orientation`)
    }
    if (typeof entityId === 'string') {
      facingOwners.add(entityId)
    }
  }
  triggerRows = get(tables, 'variable-trigger', [])
  if (!Array.isArray(triggerRows)) {
    errors.push(`${path}.components.variable-trigger must be an array`)
    triggerRows = []
  }
  for (const [index, eventEntry] of enumerate([...events, ...triggerRows])) {
    event = eventEntry
    const variableTrigger = index >= sizeOf(events)
    location = hasValue(variableTrigger) ? `${path}.components.variable-trigger[${index - sizeOf(events)}]` : `${path}.components.event[${index}]`
    if (!isRecord(event)) {
      errors.push(`${location} must be an object`)
      continue
    }
    if (hasValue(variableTrigger)) {
      ownerId = get(event, 'entityId')
      owner = typeof ownerId === 'string' ? get(owners, ownerId, {}) : {}
      if (get(owner, 'entityType') !== 'map' || !Number.isInteger(get(event, 'version')) || event.version !== 1) {
        errors.push(`${location} requires a map entity and version 1`)
      }
      let operator
      ;[variableId, operator] = [get(event, 'variableId'), get(event, 'operator')]
      if (contains(event, 'variableId') && !hasValue(validVariableId(variableId)) || !['gte', 'lte', 'equals'].includes(operator)) {
        errors.push(`${location} has an invalid variable ID or operator`)
      }
      if (contains(event, 'threshold')) {
        const threshold = event.threshold
        const kinds = operator === 'equals' ? ['integer', 'boolean', 'string'] : ['integer']
        const declaredKind = hasValue(validVariableId(variableId)) ? get(variables, variableId) : null
        if (!kinds.some((kind) => hasValue(validVariableValue(threshold, kind)))) {
          errors.push(`${location}.threshold is incompatible with its operator`)
        } else if (hasValue(declaredKind) && get(event, 'enabled') !== false && get(owner, 'enabled') !== false && !hasValue(validVariableValue(threshold, declaredKind))) {
          errors.push(`${location}.threshold is incompatible with the declared variable type`)
        }
      }
      if (isRecord(get(event, 'action')) && get(event.action, 'type') === 'legacy') {
        errors.push(`${location}.action cannot use legacy`)
      }
      if (!contains(event, 'action')) {
        continue
      }
      event = {...event, version: 2, trigger: 'enter', targetRule: 'self'}
    }
    if (Number.isInteger(get(event, 'version')) && event.version === 1) {
      continue
    }
    if (!Number.isInteger(get(event, 'version')) || event.version !== 2) {
      errors.push(`${location}.version must be 1 or 2`)
    }
    if (contains(event, 'targetRule') && !['front', 'self'].includes(get(event, 'targetRule'))) {
      errors.push(`${location}.targetRule must be front or self`)
    }
    const priority = get(event, 'priority')
    if (contains(event, 'priority') && (!Number.isInteger(priority) || Math.abs(priority) > 9007199254740991)) {
      errors.push(`${location}.priority must be a safe integer`)
    }
    if (contains(event, 'once') && !(typeof event.once === 'boolean')) {
      errors.push(`${location}.once must be boolean`)
    }
    if (contains(event, 'ruleName') && (!(typeof event.ruleName === 'string') || sizeOf(event.ruleName) > 256)) {
      errors.push(`${location}.ruleName must be text at most 256 characters`)
    }
    if (contains(event, 'directionSpace') && !['any', 'world', 'target-local'].includes(event.directionSpace)) {
      errors.push(`${location}.directionSpace is invalid`)
    }
    if (contains(event, 'onceScope') && !['rule', 'entity'].includes(event.onceScope)) {
      errors.push(`${location}.onceScope is invalid`)
    }
    if (contains(event, 'actorScope') && !['player', 'agent', 'both'].includes(event.actorScope)) {
      errors.push(`${location}.actorScope is invalid`)
    }
    if (contains(event, 'ruleKind') && !['receive', 'action'].includes(event.ruleKind)) {
      errors.push(`${location}.ruleKind is invalid`)
    }
    if (contains(event, 'movementPhase') && !['contact', 'blocked'].includes(event.movementPhase)) {
      errors.push(`${location}.movementPhase is invalid`)
    }
    for (field of ['mover', 'blocker']) {
      if (contains(event, field) && !['any', 'self', 'entity'].includes(event[field])) {
        errors.push(`${location}.${field} is invalid`)
      }
      if (contains(event, field + 'Id') && !(typeof event[field + 'Id'] === 'string')) {
        errors.push(`${location}.${field}Id must be text`)
      }
    }
    if (contains(event, 'oncePerContact') && !(typeof event.oncePerContact === 'boolean')) {
      errors.push(`${location}.oncePerContact must be boolean`)
    }
    for (const [fieldEntry, allowedSides] of [['worldSides', ['north', 'east', 'south', 'west']], ['localSides', ['front', 'right', 'back', 'left']]]) {
      field = fieldEntry
      if (contains(event, field)) {
        const sides = event[field]
        if (!Array.isArray(sides) || sides.some((side) => !(typeof side === 'string') || !contains(allowedSides, side)) || sizeOf(toSet(sides.filter((side) => typeof side === 'string'))) !== sizeOf(sides)) {
          errors.push(`${location}.${field} must contain distinct valid sides`)
        }
      }
    }
    const action = get(event, 'action')
    if (isRecord(action) && get(action, 'type') === 'legacy') {
      continue
    }
    if (!isRecord(action) || !['dialogue', 'message', 'visual-state', 'service', 'shared-variable'].includes(get(action, 'type'))) {
      errors.push(`${location}.action must be dialogue, message, visual-state, service, shared-variable or legacy`)
      continue
    }
    if (!['interact', 'enter', 'move-attempt', 'approach-player'].includes(get(event, 'trigger'))) {
      errors.push(`${location}.trigger is invalid`)
    }
    if (action.type === 'message') {
      if (contains(action, 'light') && !(typeof action.light === 'boolean')) {
        errors.push(`${location}.action.light must be boolean`)
      }
      if (contains(action, 'text') && (!(typeof action.text === 'string') || sizeOf(action.text) > 256)) {
        errors.push(`${location}.action.text must be text with at most 256 characters`)
      }
      if (contains(action, 'durationSeconds')) {
        const duration = action.durationSeconds
        if (!(typeof duration === 'number') || (0.5 > duration || duration > 15)) {
          errors.push(`${location}.action.durationSeconds must be between 0.5 and 15`)
        }
      }
    } else if (action.type === 'visual-state') {
      for (field of ['targetEntityId', 'stateId', 'groupId', 'feedback']) {
        if (contains(action, field) && (!(typeof action[field] === 'string') || sizeOf(action[field]) > 256)) {
          errors.push(`${location}.action.${field} must be text with at most 256 characters`)
        }
      }
      operation = get(action, 'operation', 'set')
      if (!['set', 'next', 'previous', 'random', 'shuffle'].includes(operation)) {
        errors.push(`${location}.action.operation is invalid`)
      }
      target = get(action, 'targetEntityId')
      let table
      ;[field, table] = operation === 'set' ? ['stateId', 'states'] : ['groupId', 'rotationGroups']
      const reference = get(action, field)
      ownerId = get(event, 'entityId')
      if (hasValue(text(target)) && hasValue(text(reference)) && get(event, 'enabled') !== false && (!(typeof ownerId === 'string') || get(get(owners, ownerId, {}), 'enabled') !== false)) {
        row = get(visualStates, target, {})
        const entries = get(row, table)
        if (get(get(owners, target, {}), 'enabled') === false || get(row, 'enabled') === false || !Array.isArray(entries) || !entries.some((item) => isRecord(item) && get(item, 'id') === reference)) {
          errors.push(`${location}.action refers to an unavailable visual target or ${field}`)
        }
      }
      if (!['interact', 'enter'].includes(get(event, 'trigger'))) {
        errors.push(`${location}.action visual-state requires interact or enter`)
      }
    } else if (action.type === 'shared-variable') {
      variableId = get(action, 'variableId')
      operation = get(action, 'variableOperation', 'set')
      if (contains(action, 'variableId') && !hasValue(validVariableId(variableId))) {
        errors.push(`${location}.action.variableId is invalid`)
      }
      if (!['set', 'add', 'toggle', 'reset'].includes(operation)) {
        errors.push(`${location}.action.variableOperation is invalid`)
      }
      if (contains(action, 'value') && !['integer', 'boolean', 'string'].some((kind) => hasValue(validVariableValue(action.value, kind)))) {
        errors.push(`${location}.action.value must be a shared variable scalar`)
      }
      entityId = get(event, 'entityId')
      const enabled = get(event, 'enabled') !== false && (!(typeof entityId === 'string') || get(get(owners, entityId, {}), 'enabled') !== false)
      if (hasValue(validVariableId(variableId)) && hasValue(enabled) && contains(variables, variableId)) {
        kind = variables[variableId]
        if (operation === 'add' && (kind !== 'integer' || contains(action, 'value') && !hasValue(validVariableValue(action.value, 'integer'))) || operation === 'toggle' && kind !== 'boolean' || operation === 'set' && contains(action, 'value') && !hasValue(validVariableValue(action.value, kind))) {
          errors.push(`${location}.action operation is incompatible with the variable type`)
        }
      }
    } else if (action.type === 'service') {
      const commandId = get(action, 'commandId', '')
      if (!(typeof commandId === 'string') || sizeOf(commandId) > 128 || hasValue(commandId) && !/^(?:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+)$(?![\s\S])/.test(commandId)) {
        errors.push(`${location}.action.commandId is invalid`)
      }
      if (contains(action, 'parameters') && !isRecord(action.parameters)) {
        errors.push(`${location}.action.parameters must be a JSON object`)
      }
      if (contains(action, 'successMessage') && (!(typeof action.successMessage === 'string') || sizeOf(action.successMessage) > 256)) {
        errors.push(`${location}.action.successMessage must be text with at most 256 characters`)
      }
    } else {
      for (field of ['presetKey', 'entryNodeId']) {
        if (contains(action, field) && (!(typeof action[field] === 'string') || sizeOf(action[field]) > 256)) {
          errors.push(`${location}.action.${field} must be text with at most 256 characters`)
        }
      }
      if (contains(action, 'uiPresetKey') && !hasValue(text(action.uiPresetKey))) {
        errors.push(`${location}.action.uiPresetKey is invalid`)
      }
    }
    if (hasValue(variableTrigger)) {
      continue
    }
    owner = get(owners, get(event, 'entityId'))
    if (!hasValue(owner) || !contains(allowed, get(owner, 'entityType'))) {
      errors.push(`${location} has an invalid owner`)
    }
    if (get(event, 'trigger') === 'move-attempt' && (get(event, 'ruleKind') === 'action' || hasValue(get(event, 'movementPhase')))) {
      continue
    }
    const targets = attachments.filter((row) => isRecord(row) && get(row, 'entityId') === get(event, 'entityId') && get(row, 'enabled') !== false).flatMap((row) => Array.isArray(get(row, 'targets')) ? get(row, 'targets') : [])
    if (!hasValue(targets) || targets.some((target) => !isRecord(target) || !['tile', 'side', 'edge'].includes(get(target, 'kind')))) {
      errors.push(`${location} requires tile/side/edge attachment`)
    }
  }
  return errors
}
