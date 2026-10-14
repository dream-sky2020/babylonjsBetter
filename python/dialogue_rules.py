"""Validation for Dialogue V4 values, conditions and event effects."""
import math


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def validate_value(value):
    if not isinstance(value, dict):
        return ["value reference must be an object"]
    if value.get("type") == "literal":
        if "value" not in value:
            return ["literal value is required"]
        item = value["value"]
        return [] if item is None or type(item) in (str, bool) or _number(item) else ["literal must be a finite scalar"]
    if value.get("type") == "memory":
        path = value.get("path")
        return [] if _text(value.get("key")) and isinstance(path, list) and path and all(_text(item) for item in path) else ["memory key and field path are required"]
    return ["unsupported value reference"]


def validate_condition(condition, depth=0):
    if depth > 32:
        return ["condition nesting exceeds 32"]
    if not isinstance(condition, dict):
        return ["condition must be an object"]
    kind = condition.get("type")
    if kind == "legacy":
        return [] if isinstance(condition.get("expression"), str) else ["legacy expression must be a string"]
    if kind in ("all", "any"):
        items = condition.get("conditions")
        if not isinstance(items, list) or not items:
            return ["condition group must be non-empty"]
        return [error for item in items for error in validate_condition(item, depth + 1)]
    if kind == "not":
        return validate_condition(condition.get("condition"), depth + 1)
    if kind == "compare":
        errors = validate_value(condition.get("left")) + validate_value(condition.get("right"))
        operator = condition.get("operator")
        if operator not in ("eq", "ne", "gt", "gte", "lt", "lte"):
            errors.append("unsupported comparison operator")
        literals = [side.get("value") for side in (condition.get("left"), condition.get("right"))
                    if isinstance(side, dict) and side.get("type") == "literal"]
        if operator not in ("eq", "ne") and any(not _number(item) for item in literals):
            errors.append("ordered comparisons require numbers")
        if len(literals) == 2 and type(literals[0]) != type(literals[1]) and not all(_number(item) for item in literals):
            errors.append("comparison types must match")
        return errors
    return ["unsupported condition type"]


def validate_event(event):
    errors = []
    if not _text(event.get("eventType")):
        errors.append("eventType is required")
    if type(event.get("version")) is not int or event["version"] < 1:
        errors.append("event version must be a positive integer")
    return errors


def validate_output_rules(output):
    errors = []
    activation = output.get("activation")
    if isinstance(activation, dict):
        if activation.get("type") == "event":
            errors.extend(validate_event(activation))
        if activation.get("type") == "auto" and "priority" in activation and not _number(activation["priority"]):
            errors.append("priority must be finite")
    if "condition" in output:
        errors.extend(validate_condition(output["condition"]))
    effects = output.get("effects", [])
    if not isinstance(effects, list):
        return errors + ["effects must be an array"]
    for effect in effects:
        if not isinstance(effect, dict):
            errors.append("effect must be an object")
        elif effect.get("type") == "legacy":
            if not isinstance(effect.get("event"), str):
                errors.append("legacy effect must contain a string")
        elif effect.get("type") == "event":
            errors.extend(validate_event(effect))
            payload = effect.get("payload", {})
            if not isinstance(payload, dict):
                errors.append("event payload must be an object")
                continue
            for name, value in payload.items():
                if not _text(name):
                    errors.append("parameter name is required")
                errors.extend(validate_value(value))
        else:
            errors.append("unsupported effect type")
    return errors
