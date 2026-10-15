"""V5 draft storage validation. Flow semantics belong to the explicit compiler."""
import math


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
    return [error for item in payload.values() for error in validate_value(item)]


def validate_document(preset_key, preset):
    if not isinstance(preset, dict) or preset.get('schemaVersion') != 5 or preset.get('presetKey') != preset_key:
        return [f'{preset_key}: V5 identity is required']
    errors = []
    if not isinstance(preset.get('name'), str) or not preset['name'].strip():
        errors.append('name is required')
    graph = preset.get('graph')
    if not isinstance(graph, dict) or not isinstance(graph.get('nodes'), dict) or not isinstance(graph.get('edges'), dict):
        return errors + ['graph.nodes and graph.edges must be objects']
    for node_id, node in graph['nodes'].items():
        if not isinstance(node, dict) or node.get('id') != node_id or not node_id.strip() or node.get('kind') not in ('condition', 'choice', 'event') or not isinstance(node.get('title'), str):
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
                if name == 'outputs' and item.get('branch') not in ('next', 'true', 'false', 'choice'):
                    errors.append(f'{node_id}: branch shape is invalid')
                if name != 'lines' and 'label' in item and not isinstance(item['label'], str):
                    errors.append(f'{node_id}: port label is invalid')
        if not isinstance(node.get('inputs'), dict) or len(node['inputs']) != 1 or not isinstance(node.get('inputOrder'), list) or len(node['inputOrder']) != 1:
            errors.append(f'{node_id}: node requires exactly one input')
        if node['kind'] == 'condition' and 'condition' in node:
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
