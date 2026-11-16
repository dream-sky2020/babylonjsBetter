import { contains, enumerate, get, hasValue, isRecord } from './jsonValues.mjs'

function finite(value, positive = false) {
  return typeof value === 'number' && Number.isFinite(value) && (!hasValue(positive) || value > 0)
}

function text(value) {
  return typeof value === 'string'
}

function id(value) {
  return text(value) && hasValue(value)
}

function vector(value, positive = false) {
  return isRecord(value) && ['x', 'y', 'z'].every((axis) => hasValue(finite(get(value, axis), positive)))
}

export function validateAnimationScenePresets(payload) {
  let objects
  let path
  let objectId
  let parentId
  let graph
  let nodes
  let connections
  let source
  let valid
  let parameters
  let outputs
  let bindings
  let mounts
  let events
  if (!isRecord(payload)) {
    return ['animation scene preset library must be an object']
  }
  const errors = []
  for (const [key, preset] of Object.entries(payload)) {
    const root = `presets.${key}`
    if (!(typeof key === 'string') || !/^(?:[a-zA-Z0-9_-]+)$(?![\s\S])/.test(key)) {
      errors.push(`${root} has an invalid key`)
      continue
    }
    if (!isRecord(preset)) {
      errors.push(`${root} must be an object`)
      continue
    }
    if (!Number.isInteger(get(preset, 'version')) || get(preset, 'version') !== 1 || !hasValue(text(get(preset, 'name'))) || !hasValue(text(get(preset, 'description')))) {
      errors.push(`${root} has an invalid version, name, or description`)
    }
    const tags = get(preset, 'tags')
    if (!Array.isArray(tags) || tags.some((tag) => !hasValue(text(tag)))) {
      errors.push(`${root}.tags must be a string array`)
    }
    objects = get(preset, 'objects')
    const objectIds = new Set()
    const objectById = {}
    if (!Array.isArray(objects)) {
      errors.push(`${root}.objects must be an array`)
      objects = []
    }
    for (const [index, item] of enumerate(objects)) {
      path = `${root}.objects[${index}]`
      if (!isRecord(item)) {
        errors.push(`${path} must be an object`)
        continue
      }
      objectId = get(item, 'id')
      if (!hasValue(id(objectId)) || contains(objectIds, objectId)) {
        errors.push(`${path}.id is invalid or duplicated`)
        continue
      }
      objectIds.add(objectId)
      objectById[objectId] = item
      if (get(item, 'parentId') !== null && !hasValue(text(get(item, 'parentId')))) {
        errors.push(`${path}.parentId is invalid`)
      }
      if (!hasValue(text(get(item, 'name'))) || !hasValue(text(get(item, 'factoryTypeId'))) || !(typeof get(item, 'enabled') === 'boolean')) {
        errors.push(`${path} has an invalid definition`)
      }
      if (!hasValue(vector(get(item, 'position'))) || !hasValue(vector(get(item, 'rotation'))) || !hasValue(vector(get(item, 'scaling'), true))) {
        errors.push(`${path} has an invalid transform`)
      }
      if (!isRecord(get(item, 'config'))) {
        errors.push(`${path}.config must be an object`)
      }
    }
    for (const [objectIdEntry, item] of Object.entries(objectById)) {
      objectId = objectIdEntry
      parentId = get(item, 'parentId')
      if (parentId !== null && !contains(objectIds, parentId)) {
        errors.push(`${root}.objects.${objectId}.parentId does not exist`)
        continue
      }
      const ancestors = new Set([objectId])
      while (parentId !== null && contains(objectById, parentId)) {
        if (contains(ancestors, parentId)) {
          errors.push(`${root}.objects.${objectId} has a parent cycle`)
          break
        }
        ancestors.add(parentId)
        parentId = get(objectById[parentId], 'parentId')
      }
    }
    graph = get(preset, 'signalGraph')
    const nodeIds = new Set()
    const outputIds = new Set()
    if (!isRecord(graph) || !Number.isInteger(get(graph, 'version')) || get(graph, 'version') !== 1) {
      errors.push(`${root}.signalGraph is invalid`)
      graph = {}
    }
    nodes = get(graph, 'nodes')
    if (!Array.isArray(nodes)) {
      errors.push(`${root}.signalGraph.nodes must be an array`)
      nodes = []
    }
    for (const [index, node] of enumerate(nodes)) {
      path = `${root}.signalGraph.nodes[${index}]`
      if (!isRecord(node)) {
        errors.push(`${path} must be an object`)
        continue
      }
      const nodeId = get(node, 'id')
      const position = get(node, 'position')
      if (!hasValue(id(nodeId)) || contains(nodeIds, nodeId)) {
        errors.push(`${path}.id is invalid or duplicated`)
        continue
      }
      nodeIds.add(nodeId)
      if (!hasValue(text(get(node, 'typeId'))) || !hasValue(text(get(node, 'label'))) || !hasValue(finite(get(node, 'version')))) {
        errors.push(`${path} has an invalid definition`)
      }
      if (!isRecord(position) || !hasValue(finite(get(position, 'x'))) || !hasValue(finite(get(position, 'y')))) {
        errors.push(`${path}.position is invalid`)
      }
      if (!isRecord(get(node, 'config'))) {
        errors.push(`${path}.config must be an object`)
      }
    }
    connections = get(graph, 'connections')
    const connectionIds = new Set()
    if (!Array.isArray(connections)) {
      errors.push(`${root}.signalGraph.connections must be an array`)
      connections = []
    }
    for (const [index, connection] of enumerate(connections)) {
      path = `${root}.signalGraph.connections[${index}]`
      source = isRecord(connection) ? get(connection, 'source') : null
      const target = isRecord(connection) ? get(connection, 'target') : null
      const connectionId = isRecord(connection) ? get(connection, 'id') : null
      valid = id(connectionId) && !contains(connectionIds, connectionId) && isRecord(source) && isRecord(target) && contains(nodeIds, get(source, 'nodeId')) && contains(nodeIds, get(target, 'nodeId')) && text(get(source, 'portId')) && text(get(target, 'portId'))
      if (!hasValue(valid)) {
        errors.push(`${path} is invalid`)
      } else if (hasValue(connectionId)) {
        connectionIds.add(connectionId)
      }
    }
    parameters = get(graph, 'parameters')
    const parameterIds = new Set()
    if (!Array.isArray(parameters)) {
      errors.push(`${root}.signalGraph.parameters must be an array`)
      parameters = []
    }
    for (const [index, parameter] of enumerate(parameters)) {
      path = `${root}.signalGraph.parameters[${index}]`
      const parameterId = isRecord(parameter) ? get(parameter, 'id') : null
      if (!hasValue(id(parameterId)) || contains(parameterIds, parameterId) || !hasValue(text(get(parameter, 'name'))) || !hasValue(text(get(parameter, 'valueTypeId')))) {
        errors.push(`${path} is invalid`)
      } else if (hasValue(parameterId)) {
        parameterIds.add(parameterId)
      }
    }
    outputs = get(graph, 'outputs')
    if (!Array.isArray(outputs)) {
      errors.push(`${root}.signalGraph.outputs must be an array`)
      outputs = []
    }
    for (const [index, output] of enumerate(outputs)) {
      path = `${root}.signalGraph.outputs[${index}]`
      source = isRecord(output) ? get(output, 'source') : null
      const outputId = isRecord(output) ? get(output, 'id') : null
      valid = id(outputId) && !contains(outputIds, outputId) && text(get(output, 'name')) && text(get(output, 'valueTypeId')) && isRecord(source) && contains(nodeIds, get(source, 'nodeId')) && text(get(source, 'portId'))
      if (!hasValue(valid)) {
        errors.push(`${path} is invalid`)
      } else if (hasValue(outputId)) {
        outputIds.add(outputId)
      }
    }
    bindings = get(preset, 'bindings')
    const bindingIds = new Set()
    if (!Array.isArray(bindings)) {
      errors.push(`${root}.bindings must be an array`)
      bindings = []
    }
    for (const [index, binding] of enumerate(bindings)) {
      path = `${root}.bindings[${index}]`
      const bindingId = isRecord(binding) ? get(binding, 'id') : null
      valid = id(bindingId) && !contains(bindingIds, bindingId) && contains(objectIds, get(binding, 'objectId')) && contains(outputIds, get(binding, 'outputId')) && text(get(binding, 'adapterTypeId')) && isRecord(get(binding, 'config'))
      if (!hasValue(valid)) {
        errors.push(`${path} is invalid`)
      } else if (hasValue(bindingId)) {
        bindingIds.add(bindingId)
      }
    }
    mounts = get(preset, 'mountPoints')
    const mountIds = new Set()
    if (!Array.isArray(mounts)) {
      errors.push(`${root}.mountPoints must be an array`)
      mounts = []
    }
    for (const [index, mount] of enumerate(mounts)) {
      path = `${root}.mountPoints[${index}]`
      const mountId = isRecord(mount) ? get(mount, 'id') : null
      const mountTags = isRecord(mount) ? get(mount, 'tags') : null
      valid = id(mountId) && !contains(mountIds, mountId) && contains(objectIds, get(mount, 'objectId')) && text(get(mount, 'name')) && text(get(mount, 'role')) && Array.isArray(mountTags) && mountTags.every((tag) => hasValue(text(tag)))
      if (!hasValue(valid)) {
        errors.push(`${path} is invalid`)
      } else if (hasValue(mountId)) {
        mountIds.add(mountId)
      }
    }
    events = get(preset, 'events')
    const eventIds = new Set()
    if (!Array.isArray(events)) {
      errors.push(`${root}.events must be an array`)
      events = []
    }
    for (const [index, marker] of enumerate(events)) {
      path = `${root}.events[${index}]`
      const eventId = isRecord(marker) ? get(marker, 'id') : null
      valid = id(eventId) && !contains(eventIds, eventId) && finite(get(marker, 'time')) && get(marker, 'time') >= 0 && text(get(marker, 'typeId')) && isRecord(get(marker, 'config'))
      if (!hasValue(valid)) {
        errors.push(`${path} is invalid`)
      } else if (hasValue(eventId)) {
        eventIds.add(eventId)
      }
    }
    const transport = get(preset, 'transport')
    if (!isRecord(transport) || !hasValue(finite(get(transport, 'duration'), true)) || !(typeof get(transport, 'loop') === 'boolean') || !hasValue(finite(get(transport, 'playbackSpeed'), true))) {
      errors.push(`${root}.transport is invalid`)
    }
  }
  return errors
}
