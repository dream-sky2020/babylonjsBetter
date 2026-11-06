"""Typed map interactions. V1 free-form events are retained for compatibility."""

def validate_map_interactions(preset, path):
    errors = []
    entities, tables = preset.get('entities'), preset.get('components')
    if not isinstance(entities, list) or not isinstance(tables, dict):
        return errors
    owners = {row.get('id'): row for row in entities if isinstance(row, dict) and isinstance(row.get('id'), str)}
    events = tables.get('event', [])
    attachments = tables.get('spatial-attachment', [])
    if not isinstance(events, list) or not isinstance(attachments, list):
        return errors
    allowed = {'tile', 'tile-edge', 'shared-edge', 'dungeon-agent', 'spatial-object', 'obstacle', 'interaction-point'}
    def text(value):
        return isinstance(value, str) and bool(value.strip()) and len(value) <= 256
    for index, event in enumerate(events):
        location = f'{path}.components.event[{index}]'
        if not isinstance(event, dict):
            errors.append(f'{location} must be an object')
            continue
        if type(event.get('version')) is int and event['version'] == 1:
            continue
        if type(event.get('version')) is not int or event['version'] != 2:
            errors.append(f'{location}.version must be 1 or 2')
        if 'targetRule' in event and event.get('targetRule') not in ('front', 'self'):
            errors.append(f'{location}.targetRule must be front or self')
        priority = event.get('priority')
        if 'priority' in event and (type(priority) is not int or abs(priority) > 9007199254740991):
            errors.append(f'{location}.priority must be a safe integer')
        if 'once' in event and not isinstance(event['once'], bool):
            errors.append(f'{location}.once must be boolean')
        action = event.get('action')
        if isinstance(action, dict) and action.get('type') == 'legacy':
            continue
        if not isinstance(action, dict) or action.get('type') != 'dialogue':
            errors.append(f'{location}.action must be dialogue or legacy')
            continue
        if event.get('trigger') not in ('interact', 'enter'):
            errors.append(f'{location}.trigger must be interact or enter')
        for field in ('presetKey', 'entryNodeId'):
            if field in action and (not isinstance(action[field], str) or len(action[field]) > 256):
                errors.append(f'{location}.action.{field} must be text with at most 256 characters')
        if 'uiPresetKey' in action and not text(action['uiPresetKey']):
            errors.append(f'{location}.action.uiPresetKey is invalid')
        owner = owners.get(event.get('entityId'))
        if not owner or owner.get('entityType') not in allowed:
            errors.append(f'{location} has an invalid owner')
        targets = [target for row in attachments if isinstance(row, dict) and row.get('entityId') == event.get('entityId') and row.get('enabled') is not False
                   for target in (row.get('targets') if isinstance(row.get('targets'), list) else [])]
        if not targets or any(not isinstance(target, dict) or target.get('kind') not in ('tile', 'side', 'edge') for target in targets):
            errors.append(f'{location} requires tile/side/edge attachment')
    return errors
