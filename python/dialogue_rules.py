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
        return [error for child in value['conditions'] for error in validate_condition(child, depth + 1)]
    if kind == 'not':
        return validate_condition(value.get('condition'), depth + 1)
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
        if not isinstance(node, dict) or node.get('id') != node_id or not node_id.strip() or node.get('kind') not in ('dialogue', 'condition', 'choice', 'event') or not isinstance(node.get('title'), str):
            errors.append(f'{node_id}: node identity is invalid')
            continue
        position, display = node.get('position'), node.get('display')
        if not isinstance(position, dict) or not all(_number(position.get(axis)) for axis in ('x', 'y')):
            errors.append(f'{node_id}: position is invalid')
        if not isinstance(display, dict) or display.get('shape') not in ('rectangle', 'rounded', 'diamond', 'hexagon', 'pill', 'document') or not isinstance(display.get('colorToken'), str):
            errors.append(f'{node_id}: display is invalid')
        elif type(display.get('widthUnits')) is not int or type(display.get('heightUnits')) is not int or not 4 <= display['widthUnits'] <= 40 or not 3 <= display['heightUnits'] <= 40:
            errors.append(f'{node_id}: display size is invalid')
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
        if node['kind'] == 'condition' and 'condition' in node:
            errors.extend(validate_condition(node['condition']))
        if node['kind'] == 'event':
            if node.get('mode') not in ('send', 'wait'):
                errors.append(f'{node_id}: event mode is invalid')
            errors.extend(validate_event(node.get('event')))
    for edge_id, edge in graph['edges'].items():
        if not isinstance(edge, dict) or edge.get('id') != edge_id or not edge_id.strip():
            errors.append(f'{edge_id}: edge identity is invalid')
            continue
        for endpoint in ('from', 'to'):
            item = edge.get(endpoint)
            if not isinstance(item, dict) or not all(isinstance(item.get(field), str) for field in ('nodeId', 'portId')):
                errors.append(f'{edge_id}: endpoint shape is invalid')
    return errors
