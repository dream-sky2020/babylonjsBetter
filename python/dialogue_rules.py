"""V5/V6 draft storage validation. Flow semantics belong to the explicit compiler."""
import math
import re


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate_value(value):
    if not isinstance(value, dict):
        return ['value must be an object']
    if value.get('type') == 'literal':
        item = value.get('value')
        return [] if 'value' in value and (item is None or type(item) in (str, bool) or _number(item)) else ['literal must be a finite scalar']
    if value.get('type') == 'memory':
        return [] if isinstance(value.get('key'), str) and isinstance(value.get('path'), list) and all(isinstance(item, str) for item in value['path']) else ['memory reference shape is invalid']
    return ['unsupported value type']


def validate_condition(value, depth=0):
    if depth > 32 or not isinstance(value, dict):
        return ['condition shape or depth is invalid']
    kind = value.get('type')
    if kind in ('all', 'any') and isinstance(value.get('conditions'), list):
        if depth or any(not isinstance(child, dict) or child.get('type') != 'compare' for child in value['conditions']):
            return ['conditions must be flat comparisons']
        return [error for child in value['conditions'] for error in validate_condition(child, depth + 1)]
    if kind == 'compare' and value.get('operator') in ('eq', 'ne', 'gt', 'gte', 'lt', 'lte'):
        return validate_value(value.get('left')) + validate_value(value.get('right'))
    return ['unsupported condition shape']


def validate_event(value):
    if not isinstance(value, dict) or value.get('type') != 'event' or not isinstance(value.get('eventType'), str) or not _number(value.get('version')):
        return ['event shape is invalid']
    payload = value.get('payload', {})
    if not isinstance(payload, dict):
        return ['payload must be an object']
    if 'correlationId' in value and not isinstance(value['correlationId'], str):
        return ['event correlationId must be a string']
    return [error for item in payload.values() for error in validate_value(item)]

def validate_wait(value):
    if not isinstance(value, dict) or not isinstance(value.get('filters'), list):
        return ['wait filters must be an array']
    errors = []
    for item in value['filters']:
        if not isinstance(item, dict) or not isinstance(item.get('field'), str) or item.get('operator') not in ('eq', 'ne', 'gt', 'gte', 'lt', 'lte'):
            errors.append('event filter shape is invalid')
        else:
            errors.extend(validate_value(item.get('value')))
    if any(field in value and not isinstance(value[field], str) for field in ('sourceModuleId', 'correlationId')):
        errors.append('wait source and correlation ID must be strings')
    if 'timeoutMs' in value and (type(value['timeoutMs']) is not int or not 0 <= value['timeoutMs'] <= 2147483647):
        errors.append('wait timeoutMs is invalid')
    if 'allowMovement' in value and type(value['allowMovement']) is not bool:
        errors.append('wait allowMovement must be boolean')
    return errors

def validate_action(value):
    if not isinstance(value, dict) or value.get('type') not in ('message', 'visual-state', 'shared-variable', 'service'):
        return ['map action shape is invalid']
    kind = value['type']
    strings = {'message': ('text',), 'visual-state': ('targetEntityId', 'stateId', 'groupId', 'feedback'),
               'shared-variable': ('variableId',), 'service': ('commandId', 'successMessage')}
    errors = []
    if any(key in value and (not isinstance(value[key], str) or len(value[key]) > 256) for key in strings[kind]):
        errors.append('map action text fields are invalid')
    if kind == 'service' and 'parameters' in value and not isinstance(value['parameters'], dict):
        errors.append('map service parameters must be an object')
    command_id = value.get('commandId')
    if kind == 'service' and isinstance(command_id, str) and command_id and (
        len(command_id) > 128 or not re.fullmatch(r'[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+', command_id)
    ):
        errors.append('map service operation ID is invalid')
    if kind == 'visual-state' and value.get('operation', 'set') not in ('set', 'next', 'previous', 'random', 'shuffle'):
        errors.append('map visual state operation is invalid')
    if kind == 'message' and 'durationSeconds' in value and (not _number(value['durationSeconds']) or not 0.5 <= value['durationSeconds'] <= 15):
        errors.append('map message duration is invalid')
    if kind == 'shared-variable':
        variable_id = value.get('variableId')
        if isinstance(variable_id, str) and variable_id and not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', variable_id):
            errors.append('map variable ID is invalid')
        if value.get('variableOperation', 'set') not in ('set', 'add', 'toggle', 'reset'):
            errors.append('map variable operation is invalid')
        if 'value' in value:
            item = value['value']
            integer = _number(item) and abs(item) <= 9007199254740991 and item == int(item)
            if not integer and (value.get('variableOperation') == 'add' or type(item) is not bool and not (isinstance(item, str) and len(item) <= 256)):
                errors.append('map variable value is invalid')
    return errors


def validate_document(preset_key, preset):
    if not isinstance(preset, dict) or preset.get('schemaVersion') not in (5, 6) or preset.get('presetKey') != preset_key:
        return [f'{preset_key}: V5 or V6 identity is required']
    legacy = preset['schemaVersion'] == 5
    kinds = ('condition', 'choice', 'event') if legacy else ('condition', 'choice', 'event', 'action')
    branches = ('next', 'true', 'false', 'choice') if legacy else ('next', 'true', 'false', 'choice', 'timeout')
    errors = []
    if not isinstance(preset.get('name'), str) or not preset['name'].strip():
        errors.append('name is required')
    bindings = preset.get('textVariables', {})
    if not isinstance(bindings, dict):
        errors.append('textVariables must be an object')
    else:
        for name, binding in bindings.items():
            if not isinstance(name, str) or not 1 <= len(name) <= 64 or any(not (ch.isalnum() or ch in '_-') for ch in name):
                errors.append(f'{name}: invalid text variable name')
            if not isinstance(binding, dict) or not isinstance(binding.get('key'), str) or not isinstance(binding.get('path'), list) or not all(isinstance(part, str) for part in binding['path']):
                errors.append(f'{name}: invalid text variable binding')
    graph = preset.get('graph')
    if not isinstance(graph, dict) or not isinstance(graph.get('nodes'), dict) or not isinstance(graph.get('edges'), dict):
        return errors + ['graph.nodes and graph.edges must be objects']
    for node_id, node in graph['nodes'].items():
        if not isinstance(node, dict) or node.get('id') != node_id or not node_id.strip() or node.get('kind') not in kinds or not isinstance(node.get('title'), str):
            errors.append(f'{node_id}: node identity is invalid')
            continue
        position, display = node.get('position'), node.get('display')
        if not isinstance(position, dict) or not all(_number(position.get(axis)) for axis in ('x', 'y')):
            errors.append(f'{node_id}: position is invalid')
        if not isinstance(display, dict) or display.get('shape') not in ('rectangle', 'rounded', 'diamond', 'hexagon', 'pill', 'document') or not isinstance(display.get('colorToken'), str):
            errors.append(f'{node_id}: display is invalid')
        elif type(display.get('widthUnits')) is not int or type(display.get('heightUnits')) is not int or not 4 <= display['widthUnits'] <= 40 or not 3 <= display['heightUnits'] <= 40:
            errors.append(f'{node_id}: display size is invalid')
        if isinstance(display, dict) and 'whitespace' in display:
            whitespace = display['whitespace']
            if not isinstance(whitespace, dict) or any(key not in ('header', 'content', 'outputs', 'top', 'sections', 'bottom', 'height') or type(value) is not bool for key, value in whitespace.items()):
                errors.append(f'{node_id}: whitespace settings are invalid')
        for name, order_name in (('lines', 'lineOrder'), ('inputs', 'inputOrder'), ('outputs', 'outputOrder')):
            items, order = node.get(name), node.get(order_name)
            if not isinstance(items, dict) or not isinstance(order, list) or not all(isinstance(item, str) for item in order):
                errors.append(f'{node_id}: {name} collection is invalid')
                continue
            if len(set(order)) != len(order) or set(order) != set(items):
                errors.append(f'{node_id}: {name} order is invalid')
            for item_id, item in items.items():
                if not isinstance(item, dict) or item.get('id') != item_id:
                    errors.append(f'{node_id}: {name} id is invalid')
                    continue
                if name == 'lines' and not all(isinstance(item.get(field), str) for field in ('speaker', 'text')):
                    errors.append(f'{node_id}: line shape is invalid')
                if name == 'outputs' and item.get('branch') not in branches:
                    errors.append(f'{node_id}: branch shape is invalid')
                if name != 'lines' and 'label' in item and not isinstance(item['label'], str):
                    errors.append(f'{node_id}: port label is invalid')
        if not isinstance(node.get('inputs'), dict) or len(node['inputs']) != 1 or not isinstance(node.get('inputOrder'), list) or len(node['inputOrder']) != 1:
            errors.append(f'{node_id}: node requires exactly one input')
        if node['kind'] == 'condition':
            if 'formula' in node and (not isinstance(node['formula'], str) or 'condition' in node):
                errors.append(f'{node_id}: condition formula must be a string and the only condition format')
            if 'condition' in node:
                errors.extend(validate_condition(node['condition']))
        if node['kind'] == 'condition':
            outputs = node.get('outputs', {})
            def fixed_output(branch, label):
                item = outputs.get(f'port:{node_id}:output:{branch}')
                return isinstance(item, dict) and item.get('branch') == branch and item.get('label') == label
            if not isinstance(outputs, dict) or len(outputs) != 2 or any(
                not fixed_output(branch, label)
                for branch, label in (('true', '成立'), ('false', '不成立'))
            ):
                errors.append(f'{node_id}: condition requires fixed true/false outputs')
        if node['kind'] == 'event':
            if node.get('mode') not in ('send', 'wait'):
                errors.append(f'{node_id}: event mode is invalid')
            events = node.get('events')
            if not isinstance(events, list) or not events or (node.get('mode') == 'wait' and len(events) != 1):
                errors.append(f'{node_id}: wait requires one event; send requires at least one event')
            else:
                for event in events:
                    errors.extend(validate_event(event))
                    if not legacy and node.get('mode') == 'wait' and isinstance(event, dict) and ('payload' in event or 'correlationId' in event):
                        errors.append(f'{node_id}: wait criteria belong in wait, not the event reference')
            if not legacy and node.get('mode') == 'wait':
                errors.extend(validate_wait(node.get('wait')))
        if node['kind'] == 'action' and 'action' in node:
            errors.extend(validate_action(node['action']))
    occupied_outputs = set()
    for edge_id, edge in graph['edges'].items():
        if not isinstance(edge, dict) or edge.get('id') != edge_id or not edge_id.strip():
            errors.append(f'{edge_id}: edge identity is invalid')
            continue
        for endpoint in ('from', 'to'):
            item = edge.get(endpoint)
            if not isinstance(item, dict) or not all(isinstance(item.get(field), str) for field in ('nodeId', 'portId')):
                errors.append(f'{edge_id}: endpoint shape is invalid')
        start, end = edge.get('from'), edge.get('to')
        if isinstance(start, dict) and isinstance(end, dict) and isinstance(start.get('nodeId'), str) and start['nodeId'] == end.get('nodeId'):
            errors.append(f'{edge_id}: node output cannot connect to its own input')
        if isinstance(start, dict) and all(isinstance(start.get(field), str) for field in ('nodeId', 'portId')):
            output = (start['nodeId'], start['portId'])
            if output in occupied_outputs:
                errors.append(f'{edge_id}: output port may have only one connection')
            occupied_outputs.add(output)
    return errors
