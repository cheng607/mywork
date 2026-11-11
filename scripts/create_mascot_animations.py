"""Author mascot scene clips in Blender and merge them into the source GLB.

Run with:
  blender --background --factory-startup --python scripts/create_mascot_animations.py -- \
    assets/models/cheng607-mascot.glb assets/models/cheng607-mascot.glb

The exporter writes a temporary GLB; only its animation accessors/channels are
merged into the source container, preserving the original Draco mesh/materials.
"""
import copy
import json
import math
import os
import struct
import sys
import tempfile

import bpy
from mathutils import Quaternion


def arguments():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    source = os.path.abspath(values[0] if values else "assets/models/cheng607-mascot.glb")
    output = os.path.abspath(values[1] if len(values) > 1 else source)
    return source, output


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or total != len(data):
        raise RuntimeError("Expected a valid GLB 2.0 file: " + path)
    offset = 12
    document, binary = None, b""
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode("utf-8"))
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
    if document is None:
        raise RuntimeError("GLB has no JSON chunk: " + path)
    return document, binary


def write_glb(path, document, binary):
    binary += b"\0" * ((-len(binary)) % 4)
    document_bytes = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    document_bytes += b" " * ((-len(document_bytes)) % 4)
    total = 12 + 8 + len(document_bytes) + 8 + len(binary)
    with open(path, "wb") as output:
        output.write(struct.pack("<4sII", b"glTF", 2, total))
        output.write(struct.pack("<II", len(document_bytes), 0x4E4F534A))
        output.write(document_bytes)
        output.write(struct.pack("<II", len(binary), 0x004E4942))
        output.write(binary)


def merge_animation_glb(source_path, animation_path, output_path):
    original, original_binary = read_glb(source_path)
    exported, exported_binary = read_glb(animation_path)
    original_names = {}
    for index, node in enumerate(original.get("nodes", [])):
        name = node.get("name")
        if name:
            original_names.setdefault(name, []).append(index)
    exported_names = {node.get("name"): index for index, node in enumerate(exported.get("nodes", [])) if node.get("name")}
    node_map = {}
    for name, exporter_index in exported_names.items():
        matches = original_names.get(name, [])
        if len(matches) == 1:
            node_map[exporter_index] = matches[0]

    appended_views = []
    appended_accessors = []
    animations = []
    binary = bytearray(original_binary)
    base_accessor = len(original.get("accessors", []))
    base_view = len(original.get("bufferViews", []))
    needed = sorted({sampler[key] for animation in exported.get("animations", [])
                     for sampler in animation.get("samplers", []) for key in ("input", "output")})
    accessor_map = {}
    for accessor_index in needed:
        accessor = copy.deepcopy(exported["accessors"][accessor_index])
        if "bufferView" in accessor:
            view = copy.deepcopy(exported["bufferViews"][accessor["bufferView"]])
            start = view.get("byteOffset", 0)
            end = start + view["byteLength"]
            data = exported_binary[start:end]
            binary.extend(b"\0" * ((-len(binary)) % 4))
            view["buffer"] = 0
            view["byteOffset"] = len(binary)
            appended_views.append(view)
            accessor["bufferView"] = base_view + len(appended_views) - 1
            binary.extend(data)
        accessor_map[accessor_index] = base_accessor + len(appended_accessors)
        appended_accessors.append(accessor)

    for exported_animation in exported.get("animations", []):
        animation = copy.deepcopy(exported_animation)
        channels = []
        used_samplers = set()
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            old_node = target.get("node")
            if old_node not in node_map:
                continue
            target["node"] = node_map[old_node]
            used_samplers.add(channel["sampler"])
            channels.append(channel)
        if not channels:
            continue
        sampler_map = {}
        samplers = []
        for old_index, sampler in enumerate(animation.get("samplers", [])):
            if old_index not in used_samplers:
                continue
            sampler["input"] = accessor_map[sampler["input"]]
            sampler["output"] = accessor_map[sampler["output"]]
            sampler_map[old_index] = len(samplers)
            samplers.append(sampler)
        for channel in channels:
            channel["sampler"] = sampler_map[channel["sampler"]]
        animation["channels"] = channels
        animation["samplers"] = samplers
        animations.append(animation)

    if not animations:
        raise RuntimeError("Blender did not export any animation channels.")
    original.setdefault("bufferViews", []).extend(appended_views)
    original.setdefault("accessors", []).extend(appended_accessors)
    generated_names = {animation.get("name") for animation in animations}
    original["animations"] = [animation for animation in original.get("animations", [])
                               if animation.get("name") not in generated_names]
    original["animations"].extend(animations)
    original["buffers"][0]["byteLength"] = len(binary)
    write_glb(output_path, original, bytes(binary))
    print("Merged animation clips:", [animation.get("name") for animation in animations])
    print("Animation channels:", sum(len(animation["channels"]) for animation in animations))


def smooth(t):
    return t * t * (3 - 2 * t)


def pose_values(kind, t):
    """Return local-X pose offsets in radians for Mixamo bone suffixes."""
    if kind in ("sit_down", "stand_up"):
        progress = smooth(t if kind == "sit_down" else 1 - t)
        values = {
            "Hips": (0.05 * progress, 0, 0),
            "Spine": (-0.06 * progress, 0, 0), "Spine1": (-0.035 * progress, 0, 0),
            "LeftUpLeg": (-0.52 * progress, 0, 0), "RightUpLeg": (-0.52 * progress, 0, 0),
            "LeftLeg": (0.82 * progress, 0, 0), "RightLeg": (0.82 * progress, 0, 0),
            "LeftArm": (-0.26 * progress, 0, -0.035 * progress),
            "RightArm": (-0.3 * progress, 0, 0.035 * progress),
            "LeftForeArm": (0.42 * progress, 0, 0), "RightForeArm": (0.48 * progress, 0, 0),
        }
        return values
    if kind == "gaming_play":
        cycle = math.sin(2 * math.pi * t)
        return {
            "Hips": (0.05, 0, 0), "Spine": (-0.06, 0, 0), "Spine1": (-0.035, 0, 0),
            "Spine2": (-0.012 + cycle * 0.018, 0, cycle * 0.012),
            "Neck": (cycle * 0.018, 0, 0), "Head": (-cycle * 0.012, 0, 0),
            "LeftUpLeg": (-0.52, 0, 0), "RightUpLeg": (-0.52, 0, 0),
            "LeftLeg": (0.82, 0, 0), "RightLeg": (0.82, 0, 0),
            "LeftArm": (-0.5 - cycle * 0.04, 0, -0.035),
            "RightArm": (-0.55 + cycle * 0.045, 0, 0.035),
            "LeftForeArm": (0.7 + cycle * 0.08, 0, 0),
            "RightForeArm": (0.76 - cycle * 0.1, 0, 0),
        }
    # Dining: lift the right hand for each bite; the left hand rests near the bowl.
    bite = (1 - math.cos(2 * math.pi * t)) * 0.5
    return {
        "Hips": (0.04, 0, 0), "Spine": (-0.08, 0, 0), "Spine1": (-0.04, 0, 0),
        "Spine2": (-0.025 - bite * 0.035, 0, 0),
        "Neck": (-bite * 0.075, 0, 0), "Head": (bite * 0.035, 0, 0),
        "LeftUpLeg": (-0.52, 0, 0), "RightUpLeg": (-0.52, 0, 0),
        "LeftLeg": (0.82, 0, 0), "RightLeg": (0.82, 0, 0),
        "LeftArm": (-0.32, 0, -0.04), "RightArm": (-1.05 - bite * 0.45, 0, 0.04),
        "LeftForeArm": (0.46, 0, 0), "RightForeArm": (-0.35 - bite * 0.8, 0, 0),
        "RightHand": (-0.15 - bite * 0.12, 0, 0),
    }


def make_action(armature, name, key_times, kind):
    action = bpy.data.actions.new(name)
    armature.animation_data.action = action
    if hasattr(action, "slots") and len(action.slots):
        armature.animation_data.action_slot = action.slots[0]
    bone_lookup = {bone.name.rsplit(":", 1)[-1]: bone for bone in armature.pose.bones}
    # The imported idle establishes the exact neutral character pose. Each new
    # key is composed over that pose, instead of replacing its bone orientation.
    bpy.context.scene.frame_set(1)
    bases = {bone.name: bone.rotation_quaternion.copy() for bone in armature.pose.bones}
    for frame, t in key_times:
        pose = pose_values(kind, t)
        for suffix, angles in pose.items():
            bone = bone_lookup.get(suffix)
            if not bone:
                continue
            delta = Quaternion((1, 0, 0), angles[0]) @ Quaternion((0, 1, 0), angles[1]) @ Quaternion((0, 0, 1), angles[2])
            bone.rotation_quaternion = bases[bone.name] @ delta
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone.name)
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(action.slots[0]) if len(action.slots) else None
            if bag:
                curves.extend(bag.fcurves)
    if curves:
        for curve in curves:
            for point in curve.keyframe_points:
                point.interpolation = "BEZIER"
                point.handle_left_type = "AUTO_CLAMPED"
                point.handle_right_type = "AUTO_CLAMPED"
    action.use_fake_user = True
    return action


def main():
    source, output = arguments()
    if not os.path.isfile(source):
        raise FileNotFoundError(source)
    bpy.ops.import_scene.gltf(filepath=source)
    armature = next((obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"), None)
    if not armature:
        raise RuntimeError("No armature found in the input GLB.")
    # Remove factory-startup objects that are unrelated to the imported mascot.
    for name in ("Cube", "Camera", "Light"):
        obj = bpy.data.objects.get(name)
        if obj and obj not in [armature, *armature.children_recursive]:
            bpy.data.objects.remove(obj, do_unlink=True)

    idle = next((action for action in bpy.data.actions if "idle" in action.name.lower()), None)
    if idle:
        armature.animation_data.action = idle
        if hasattr(idle, "slots") and len(idle.slots):
            armature.animation_data.action_slot = idle.slots[0]

    # Reuse the intended names on reruns instead of exporting .001 duplicates.
    for action in list(bpy.data.actions):
        if action.name.startswith("scene_"):
            bpy.data.actions.remove(action)

    fps = bpy.context.scene.render.fps
    actions = [
        make_action(armature, "scene_sit_down", [(1, 0), (10, .14), (21, .55), (31, 1)], "sit_down"),
        make_action(armature, "scene_stand_up", [(1, 0), (10, .14), (21, .55), (31, 1)], "stand_up"),
        make_action(armature, "scene_gaming_play", [(1, 0), (37, .5), (73, 1)], "gaming_play"),
        make_action(armature, "scene_dining_eat", [(1, 0), (37, .5), (73, 1)], "dining_eat"),
    ]
    # The imported idle remains in the source GLB; it only supplies the bind
    # reference for our new poses and does not need a duplicate export track.
    armature.animation_data.action = None
    if idle:
        bpy.data.actions.remove(idle)
    # Give all tracks a one-second (transition) or one-second (loop) cadence.
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 239
    tmp = tempfile.NamedTemporaryFile(prefix="mascot-clips-", suffix=".glb", delete=False)
    temporary_glb = tmp.name
    tmp.close()
    try:
        bpy.ops.export_scene.gltf(
            filepath=temporary_glb, export_format="GLB", export_animations=True,
            export_animation_mode="ACTIONS", export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6, export_image_format="AUTO",
            export_apply=False,
        )
        merge_animation_glb(source, temporary_glb, output)
    finally:
        if os.path.exists(temporary_glb):
            os.remove(temporary_glb)
    print("Updated GLB:", output, os.path.getsize(output), "bytes")


if __name__ == "__main__":
    main()
