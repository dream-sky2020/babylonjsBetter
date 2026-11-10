"""Typed map interactions. V1 free-form events are retained for compatibility."""

import math
import re


def validate_visual_components(tables, owners, path):
    errors = []
    objects, states = {}, {}
    def valid_id(value):
        return isinstance(value, str) and bool(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,95}', value)) and value not in ('constructor', 'prototype')
    def number(value):
        return type(value) in (int, float) and math.isfinite(value)
    def color(value):
        return isinstance(value, str) and bool(re.fullmatch(r'#[a-fA-F0-9]{6}', value))
    for kind, by_owner in (('visual-objects', objects), ('visual-state', states)):
        rows = tables.get(kind, [])
        if not isinstance(rows, list):
            errors.append(f'{path}.components.{kind} must be an array')
            continue
        for row in rows:
            entity_id = row.get('entityId') if isinstance(row, dict) else None
            owner = owners.get(entity_id) if isinstance(entity_id, str) else None
            if not owner or owner.get('entityType') != 'visual-object' or entity_id in by_owner or type(row.get('version')) is not int or row['version'] != 1:
                errors.append(f'{path}.components.{kind} has an invalid owner, version or duplicate component')
                continue
            by_owner[entity_id] = row
    for entity_id, row in objects.items():
        names = set()
        entries = row.get('objects')
        if not isinstance(entries, list):
            errors.append(f'{path}.{entity_id}.objects must be an array')
            continue
        for entry in entries:
            name = entry.get('name') if isinstance(entry, dict) else None
            if not valid_id(name) or name in names:
                errors.append(f'{path}.{entity_id} has an invalid or duplicate visual object name')
                continue
            names.add(name)
            offset, kind = entry.get('offset'), entry.get('kind')
            valid_offset = isinstance(offset, list) and len(offset) == 3 and all(map(number, offset))
            valid_enabled = 'enabled' not in entry or type(entry['enabled']) is bool
            if kind == 'point-light':
                intensity, distance = entry.get('intensity'), entry.get('range')
                valid_object = color(entry.get('color')) and number(intensity) and intensity >= 0 and number(distance) and distance > 0
            elif kind == 'sphere':
                diameter = entry.get('diameter')
                valid_object = color(entry.get('color')) and number(diameter) and diameter > 0
            else:
                model = entry.get('modelPath')
                valid_object = kind == 'model' and isinstance(model, str) and bool(re.fullmatch(r'resources/[^?#]+\.(glb|gltf)', model, re.I)) and '\\' not in model and all(part not in ('', '.', '..') for part in model.split('/'))
            if not valid_offset or not valid_enabled or not valid_object:
                errors.append(f'{path}.{entity_id}.{name} has invalid visual object parameters')
    for entity_id, row in states.items():
        entries = row.get('states')
        if not isinstance(entries, list) or not valid_id(row.get('initialState')):
            errors.append(f'{path}.{entity_id} requires an initial state and state list')
            continue
        ids = set()
        source = objects.get(entity_id, {}).get('objects')
        names = {item['name'] for item in source if isinstance(item, dict) and valid_id(item.get('name'))} if isinstance(source, list) else set()
        for entry in entries:
            state_id = entry.get('id') if isinstance(entry, dict) else None
            enabled = entry.get('enabled') if isinstance(entry, dict) else None
            if not valid_id(state_id) or state_id in ids or not isinstance(enabled, dict) or any(not valid_id(key) or type(value) is not bool for key, value in enabled.items()):
                errors.append(f'{path}.{entity_id} has an invalid or duplicate visual state')
                continue
            ids.add(state_id)
            if 'label' in entry and (not isinstance(entry['label'], str) or not entry['label'].strip() or len(entry['label']) > 80):
                errors.append(f'{path}.{entity_id}.{state_id} has an invalid display label')
            if row.get('enabled') is not False and owners[entity_id].get('enabled') is not False and any(key not in names for key in enabled):
                errors.append(f'{path}.{entity_id}.{state_id} refers to an unknown local object')
        if row.get('enabled') is not False and owners[entity_id].get('enabled') is not False and row['initialState'] not in ids:
            errors.append(f'{path}.{entity_id} initial visual state is missing')
        groups = row.get('rotationGroups', [])
        if not isinstance(groups, list):
            errors.append(f'{path}.{entity_id} rotationGroups must be an array')
            continue
        group_ids = set()
        for group in groups:
            group_id = group.get('id') if isinstance(group, dict) else None
            members = group.get('stateIds') if isinstance(group, dict) else None
            if not valid_id(group_id) or group_id in group_ids or not isinstance(members, list) or not members or any(not valid_id(member) or member not in ids for member in members) or len(set(members)) != len(members):
                errors.append(f'{path}.{entity_id} has an invalid rotation group or member')
                continue
            group_ids.add(group_id)
    return states, errors

def valid_variable_id(value):
    return isinstance(value, str) and re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', value) is not None


def valid_variable_value(value, kind):
    if kind == 'integer':
        return type(value) in (int, float) and abs(value) <= 9007199254740991 and value == int(value)
    if kind == 'boolean':
        return type(value) is bool
    return kind == 'string' and isinstance(value, str) and len(value) <= 256


def validate_map_interactions(preset, path):
    errors = []
    entities, tables = preset.get('entities'), preset.get('components')
    if not isinstance(entities, list) or not isinstance(tables, dict):
        return errors
    owners = {row.get('id'): row for row in entities if isinstance(row, dict) and isinstance(row.get('id'), str)}
    visual_states, visual_errors = validate_visual_components(tables, owners, path)
    errors.extend(visual_errors)
    variables = {}
    variable_rows = tables.get('shared-variable', [])
    if not isinstance(variable_rows, list):
        errors.append(f'{path}.components.shared-variable must be an array')
        variable_rows = []
    for index, row in enumerate(variable_rows):
        location = f'{path}.components.shared-variable[{index}]'
        if not isinstance(row, dict):
            errors.append(f'{location} must be an object')
            continue
        entity_id, variable_id = row.get('entityId'), row.get('variableId')
        owner = owners.get(entity_id, {}) if isinstance(entity_id, str) else {}
        kind = row.get('valueType')
        if owner.get('entityType') != 'map' or type(row.get('version')) is not int or row['version'] != 1 or not valid_variable_id(variable_id):
            errors.append(f'{location} requires a valid variable ID on a map entity')
        if not valid_variable_value(row.get('initialValue'), kind) or row.get('scope', 'lab') not in ('lab', 'map'):
            errors.append(f'{location} has an invalid initial value, type or scope')
        if 'label' in row and (not isinstance(row['label'], str) or not row['label'].strip() or len(row['label']) > 80):
            errors.append(f'{location}.label is invalid')
        if valid_variable_id(variable_id) and row.get('enabled') is not False and owner.get('enabled') is not False:
            if variable_id in variables:
                errors.append(f'{location} has a duplicate variable ID')
            variables[variable_id] = kind
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
    trigger_rows = tables.get('variable-trigger', [])
    if not isinstance(trigger_rows, list):
        errors.append(f'{path}.components.variable-trigger must be an array')
        trigger_rows = []
    for index, event in enumerate([*events, *trigger_rows]):
        variable_trigger = index >= len(events)
        location = (f'{path}.components.variable-trigger[{index - len(events)}]' if variable_trigger
                    else f'{path}.components.event[{index}]')
        if not isinstance(event, dict):
            errors.append(f'{location} must be an object')
            continue
        if variable_trigger:
            owner_id = event.get('entityId')
            owner = owners.get(owner_id, {}) if isinstance(owner_id, str) else {}
            if owner.get('entityType') != 'map' or type(event.get('version')) is not int or event['version'] != 1:
                errors.append(f'{location} requires a map entity and version 1')
            variable_id, operator = event.get('variableId'), event.get('operator')
            if ('variableId' in event and not valid_variable_id(variable_id)) or operator not in ('gte', 'lte', 'equals'):
                errors.append(f'{location} has an invalid variable ID or operator')
            if 'threshold' in event:
                threshold = event['threshold']
                kinds = ('integer', 'boolean', 'string') if operator == 'equals' else ('integer',)
                declared_kind = variables.get(variable_id) if valid_variable_id(variable_id) else None
                if not any(valid_variable_value(threshold, kind) for kind in kinds):
                    errors.append(f'{location}.threshold is incompatible with its operator')
                elif declared_kind and event.get('enabled') is not False and owner.get('enabled') is not False and not valid_variable_value(threshold, declared_kind):
                    errors.append(f'{location}.threshold is incompatible with the declared variable type')
            if isinstance(event.get('action'), dict) and event['action'].get('type') == 'legacy':
                errors.append(f'{location}.action cannot use legacy')
            if 'action' not in event:
                continue
            event = {**event, 'version': 2, 'trigger': 'enter', 'targetRule': 'self'}
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
        if not isinstance(action, dict) or action.get('type') not in ('dialogue', 'message', 'visual-state', 'service', 'shared-variable'):
            errors.append(f'{location}.action must be dialogue, message, visual-state, service, shared-variable or legacy')
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
        elif action['type'] == 'visual-state':
            for field in ('targetEntityId', 'stateId', 'groupId', 'feedback'):
                if field in action and (not isinstance(action[field], str) or len(action[field]) > 256):
                    errors.append(f'{location}.action.{field} must be text with at most 256 characters')
            operation = action.get('operation', 'set')
            if operation not in ('set', 'next', 'previous', 'random', 'shuffle'):
                errors.append(f'{location}.action.operation is invalid')
            target = action.get('targetEntityId')
            field, table = ('stateId', 'states') if operation == 'set' else ('groupId', 'rotationGroups')
            reference = action.get(field)
            owner_id = event.get('entityId')
            if text(target) and text(reference) and event.get('enabled') is not False and (not isinstance(owner_id, str) or owners.get(owner_id, {}).get('enabled') is not False):
                row = visual_states.get(target, {})
                entries = row.get(table)
                if owners.get(target, {}).get('enabled') is False or row.get('enabled') is False or not isinstance(entries, list) or not any(isinstance(item, dict) and item.get('id') == reference for item in entries):
                    errors.append(f'{location}.action refers to an unavailable visual target or {field}')
            if event.get('trigger') not in ('interact', 'enter'):
                errors.append(f'{location}.action visual-state requires interact or enter')
        elif action['type'] == 'shared-variable':
            variable_id = action.get('variableId')
            operation = action.get('variableOperation', 'set')
            if 'variableId' in action and not valid_variable_id(variable_id):
                errors.append(f'{location}.action.variableId is invalid')
            if operation not in ('set', 'add', 'toggle', 'reset'):
                errors.append(f'{location}.action.variableOperation is invalid')
            if 'value' in action and not any(valid_variable_value(action['value'], kind) for kind in ('integer', 'boolean', 'string')):
                errors.append(f'{location}.action.value must be a shared variable scalar')
            entity_id = event.get('entityId')
            enabled = event.get('enabled') is not False and (not isinstance(entity_id, str) or owners.get(entity_id, {}).get('enabled') is not False)
            if valid_variable_id(variable_id) and enabled and variable_id in variables:
                kind = variables[variable_id]
                if operation == 'add' and (kind != 'integer' or 'value' in action and not valid_variable_value(action['value'], 'integer')) or operation == 'toggle' and kind != 'boolean' or operation == 'set' and 'value' in action and not valid_variable_value(action['value'], kind):
                    errors.append(f'{location}.action operation is incompatible with the variable type')
        elif action['type'] == 'service':
            command_id = action.get('commandId', '')
            if not isinstance(command_id, str) or len(command_id) > 128 or command_id and not re.fullmatch(r'[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+', command_id):
                errors.append(f'{location}.action.commandId is invalid')
            if 'parameters' in action and not isinstance(action['parameters'], dict):
                errors.append(f'{location}.action.parameters must be a JSON object')
            if 'successMessage' in action and (not isinstance(action['successMessage'], str) or len(action['successMessage']) > 256):
                errors.append(f'{location}.action.successMessage must be text with at most 256 characters')
        else:
            for field in ('presetKey', 'entryNodeId'):
                if field in action and (not isinstance(action[field], str) or len(action[field]) > 256):
                    errors.append(f'{location}.action.{field} must be text with at most 256 characters')
            if 'uiPresetKey' in action and not text(action['uiPresetKey']):
                errors.append(f'{location}.action.uiPresetKey is invalid')
        if variable_trigger:
            continue
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
