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
    facing_owners = set()
    facing_rows = tables.get('grid-facing', [])
    if not isinstance(facing_rows, list):
        errors.append(f'{path}.components.grid-facing must be an array')
        facing_rows = []
    for row in facing_rows:
        entity_id = row.get('entityId') if isinstance(row, dict) else None
        owner = owners.get(entity_id) if isinstance(entity_id, str) else None
        if not owner or owner.get('entityType') not in ('interaction-point', 'tile', 'tile-edge', 'shared-edge') or entity_id in facing_owners or type(row.get('version')) is not int or row['version'] != 1 or row.get('facing') not in ('north', 'east', 'south', 'west'):
            errors.append(f'{path}.components.grid-facing has invalid or duplicate orientation')
        if isinstance(entity_id, str):
            facing_owners.add(entity_id)
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
        if 'ruleName' in event and (not isinstance(event['ruleName'], str) or len(event['ruleName']) > 256):
            errors.append(f'{location}.ruleName must be text at most 256 characters')
        if 'directionSpace' in event and event['directionSpace'] not in ('any', 'world', 'target-local'):
            errors.append(f'{location}.directionSpace is invalid')
        if 'onceScope' in event and event['onceScope'] not in ('rule', 'entity'):
            errors.append(f'{location}.onceScope is invalid')
        if 'actorScope' in event and event['actorScope'] not in ('player', 'agent', 'both'):
            errors.append(f'{location}.actorScope is invalid')
        if 'ruleKind' in event and event['ruleKind'] not in ('receive', 'action'):
            errors.append(f'{location}.ruleKind is invalid')
        if 'movementPhase' in event and event['movementPhase'] not in ('contact', 'blocked'):
            errors.append(f'{location}.movementPhase is invalid')
        for field in ('mover', 'blocker'):
            if field in event and event[field] not in ('any', 'self', 'entity'):
                errors.append(f'{location}.{field} is invalid')
            if field + 'Id' in event and not isinstance(event[field + 'Id'], str):
                errors.append(f'{location}.{field}Id must be text')
        if 'oncePerContact' in event and not isinstance(event['oncePerContact'], bool):
            errors.append(f'{location}.oncePerContact must be boolean')
        for field, allowed_sides in [('worldSides', ('north', 'east', 'south', 'west')), ('localSides', ('front', 'right', 'back', 'left'))]:
            if field in event:
                sides = event[field]
                if not isinstance(sides, list) or any(not isinstance(side, str) or side not in allowed_sides for side in sides) or len(set(side for side in sides if isinstance(side, str))) != len(sides):
                    errors.append(f'{location}.{field} must contain distinct valid sides')
        action = event.get('action')
        if isinstance(action, dict) and action.get('type') == 'legacy':
            continue
        if not isinstance(action, dict) or action.get('type') not in ('dialogue', 'message'):
            errors.append(f'{location}.action must be dialogue, message or legacy')
            continue
        if event.get('trigger') not in ('interact', 'enter', 'move-attempt', 'approach-player'):
            errors.append(f'{location}.trigger is invalid')
        if action['type'] == 'message':
            if 'light' in action and not isinstance(action['light'], bool):
                errors.append(f'{location}.action.light must be boolean')
            if 'text' in action and (not isinstance(action['text'], str) or len(action['text']) > 256):
                errors.append(f'{location}.action.text must be text with at most 256 characters')
            if 'durationSeconds' in action:
                duration = action['durationSeconds']
                if type(duration) not in (int, float) or not .5 <= duration <= 15:
                    errors.append(f'{location}.action.durationSeconds must be between 0.5 and 15')
        else:
            for field in ('presetKey', 'entryNodeId'):
                if field in action and (not isinstance(action[field], str) or len(action[field]) > 256):
                    errors.append(f'{location}.action.{field} must be text with at most 256 characters')
            if 'uiPresetKey' in action and not text(action['uiPresetKey']):
                errors.append(f'{location}.action.uiPresetKey is invalid')
        owner = owners.get(event.get('entityId'))
        if not owner or owner.get('entityType') not in allowed:
            errors.append(f'{location} has an invalid owner')
        if event.get('trigger') == 'move-attempt' and (event.get('ruleKind') == 'action' or event.get('movementPhase')):
            continue
        targets = [target for row in attachments if isinstance(row, dict) and row.get('entityId') == event.get('entityId') and row.get('enabled') is not False
                   for target in (row.get('targets') if isinstance(row.get('targets'), list) else [])]
        if not targets or any(not isinstance(target, dict) or target.get('kind') not in ('tile', 'side', 'edge') for target in targets):
            errors.append(f'{location} requires tile/side/edge attachment')
    return errors
