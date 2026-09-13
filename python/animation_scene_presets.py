"""Validation for generic Animation Workbench scene preset libraries."""
import math
import re


def _finite(value, positive=False):
    return type(value) in (int, float) and math.isfinite(value) and (not positive or value > 0)


def _text(value):
    return isinstance(value, str)


def _id(value):
    return _text(value) and bool(value)


def _vector(value, positive=False):
    return isinstance(value, dict) and all(_finite(value.get(axis), positive) for axis in "xyz")


def validate_animation_scene_presets(payload):
    if not isinstance(payload, dict):
        return ["animation scene preset library must be an object"]
    errors = []
    for key, preset in payload.items():
        root = f"presets.{key}"
        if not isinstance(key, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", key):
            errors.append(f"{root} has an invalid key")
            continue
        if not isinstance(preset, dict):
            errors.append(f"{root} must be an object")
            continue
        if type(preset.get("version")) is not int or preset.get("version") != 1 or not _text(preset.get("name")) or not _text(preset.get("description")):
            errors.append(f"{root} has an invalid version, name, or description")
        tags = preset.get("tags")
        if not isinstance(tags, list) or any(not _text(tag) for tag in tags):
            errors.append(f"{root}.tags must be a string array")

        objects = preset.get("objects")
        object_ids = set()
        object_by_id = {}
        if not isinstance(objects, list):
            errors.append(f"{root}.objects must be an array")
            objects = []
        for index, item in enumerate(objects):
            path = f"{root}.objects[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{path} must be an object")
                continue
            object_id = item.get("id")
            if not _id(object_id) or object_id in object_ids:
                errors.append(f"{path}.id is invalid or duplicated")
                continue
            object_ids.add(object_id)
            object_by_id[object_id] = item
            if item.get("parentId") is not None and not _text(item.get("parentId")):
                errors.append(f"{path}.parentId is invalid")
            if not _text(item.get("name")) or not _text(item.get("factoryTypeId")) or type(item.get("enabled")) is not bool:
                errors.append(f"{path} has an invalid definition")
            if not _vector(item.get("position")) or not _vector(item.get("rotation")) or not _vector(item.get("scaling"), True):
                errors.append(f"{path} has an invalid transform")
            if not isinstance(item.get("config"), dict):
                errors.append(f"{path}.config must be an object")
        for object_id, item in object_by_id.items():
            parent_id = item.get("parentId")
            if parent_id is not None and parent_id not in object_ids:
                errors.append(f"{root}.objects.{object_id}.parentId does not exist")
                continue
            ancestors = {object_id}
            while parent_id is not None and parent_id in object_by_id:
                if parent_id in ancestors:
                    errors.append(f"{root}.objects.{object_id} has a parent cycle")
                    break
                ancestors.add(parent_id)
                parent_id = object_by_id[parent_id].get("parentId")

        graph = preset.get("signalGraph")
        node_ids = set()
        output_ids = set()
        if not isinstance(graph, dict) or type(graph.get("version")) is not int or graph.get("version") != 1:
            errors.append(f"{root}.signalGraph is invalid")
            graph = {}
        nodes = graph.get("nodes")
        if not isinstance(nodes, list):
            errors.append(f"{root}.signalGraph.nodes must be an array")
            nodes = []
        for index, node in enumerate(nodes):
            path = f"{root}.signalGraph.nodes[{index}]"
            if not isinstance(node, dict):
                errors.append(f"{path} must be an object")
                continue
            node_id = node.get("id")
            position = node.get("position")
            if not _id(node_id) or node_id in node_ids:
                errors.append(f"{path}.id is invalid or duplicated")
                continue
            node_ids.add(node_id)
            if not _text(node.get("typeId")) or not _text(node.get("label")) or not _finite(node.get("version")):
                errors.append(f"{path} has an invalid definition")
            if not isinstance(position, dict) or not _finite(position.get("x")) or not _finite(position.get("y")):
                errors.append(f"{path}.position is invalid")
            if not isinstance(node.get("config"), dict):
                errors.append(f"{path}.config must be an object")
        connections = graph.get("connections")
        connection_ids = set()
        if not isinstance(connections, list):
            errors.append(f"{root}.signalGraph.connections must be an array")
            connections = []
        for index, connection in enumerate(connections):
            path = f"{root}.signalGraph.connections[{index}]"
            source = connection.get("source") if isinstance(connection, dict) else None
            target = connection.get("target") if isinstance(connection, dict) else None
            connection_id = connection.get("id") if isinstance(connection, dict) else None
            valid = (_id(connection_id) and connection_id not in connection_ids and isinstance(source, dict) and isinstance(target, dict)
                     and source.get("nodeId") in node_ids and target.get("nodeId") in node_ids
                     and _text(source.get("portId")) and _text(target.get("portId")))
            if not valid:
                errors.append(f"{path} is invalid")
            elif connection_id:
                connection_ids.add(connection_id)
        parameters = graph.get("parameters")
        parameter_ids = set()
        if not isinstance(parameters, list):
            errors.append(f"{root}.signalGraph.parameters must be an array")
            parameters = []
        for index, parameter in enumerate(parameters):
            path = f"{root}.signalGraph.parameters[{index}]"
            parameter_id = parameter.get("id") if isinstance(parameter, dict) else None
            if not (_id(parameter_id) and parameter_id not in parameter_ids and _text(parameter.get("name")) and _text(parameter.get("valueTypeId"))):
                errors.append(f"{path} is invalid")
            elif parameter_id:
                parameter_ids.add(parameter_id)
        outputs = graph.get("outputs")
        if not isinstance(outputs, list):
            errors.append(f"{root}.signalGraph.outputs must be an array")
            outputs = []
        for index, output in enumerate(outputs):
            path = f"{root}.signalGraph.outputs[{index}]"
            source = output.get("source") if isinstance(output, dict) else None
            output_id = output.get("id") if isinstance(output, dict) else None
            valid = (_id(output_id) and output_id not in output_ids and _text(output.get("name")) and _text(output.get("valueTypeId"))
                     and isinstance(source, dict) and source.get("nodeId") in node_ids and _text(source.get("portId")))
            if not valid:
                errors.append(f"{path} is invalid")
            elif output_id:
                output_ids.add(output_id)

        bindings = preset.get("bindings")
        binding_ids = set()
        if not isinstance(bindings, list):
            errors.append(f"{root}.bindings must be an array")
            bindings = []
        for index, binding in enumerate(bindings):
            path = f"{root}.bindings[{index}]"
            binding_id = binding.get("id") if isinstance(binding, dict) else None
            valid = (_id(binding_id) and binding_id not in binding_ids and binding.get("objectId") in object_ids
                     and binding.get("outputId") in output_ids and _text(binding.get("adapterTypeId")) and isinstance(binding.get("config"), dict))
            if not valid:
                errors.append(f"{path} is invalid")
            elif binding_id:
                binding_ids.add(binding_id)
        mounts = preset.get("mountPoints")
        mount_ids = set()
        if not isinstance(mounts, list):
            errors.append(f"{root}.mountPoints must be an array")
            mounts = []
        for index, mount in enumerate(mounts):
            path = f"{root}.mountPoints[{index}]"
            mount_id = mount.get("id") if isinstance(mount, dict) else None
            mount_tags = mount.get("tags") if isinstance(mount, dict) else None
            valid = (_id(mount_id) and mount_id not in mount_ids and mount.get("objectId") in object_ids
                     and _text(mount.get("name")) and _text(mount.get("role"))
                     and isinstance(mount_tags, list) and all(_text(tag) for tag in mount_tags))
            if not valid:
                errors.append(f"{path} is invalid")
            elif mount_id:
                mount_ids.add(mount_id)
        events = preset.get("events")
        event_ids = set()
        if not isinstance(events, list):
            errors.append(f"{root}.events must be an array")
            events = []
        for index, marker in enumerate(events):
            path = f"{root}.events[{index}]"
            event_id = marker.get("id") if isinstance(marker, dict) else None
            valid = (_id(event_id) and event_id not in event_ids and _finite(marker.get("time")) and marker.get("time") >= 0
                     and _text(marker.get("typeId")) and isinstance(marker.get("config"), dict))
            if not valid:
                errors.append(f"{path} is invalid")
            elif event_id:
                event_ids.add(event_id)
        transport = preset.get("transport")
        if not (isinstance(transport, dict) and _finite(transport.get("duration"), True)
                and type(transport.get("loop")) is bool and _finite(transport.get("playbackSpeed"), True)):
            errors.append(f"{root}.transport is invalid")
    return errors
