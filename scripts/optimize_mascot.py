"""Build the web mascot from the archival GLB with Blender (no source mutation).

blender --background --factory-startup --python scripts/optimize_mascot.py
"""
import os
import bpy

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(root, 'assets/models/cheng607-mascot.glb'))

for obj in bpy.context.scene.objects:
    obj.animation_data_clear()
    if obj.type == 'ARMATURE':
        for bone in obj.pose.bones:
            bone.matrix_basis.identity()

for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    nodes = material.node_tree.nodes
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    # The generated normal/specular textures exaggerate pores and produce speckles.
    for socket in ('Normal', 'Roughness', 'Metallic', 'Specular IOR Level', 'Specular Tint'):
        for link in list(shader.inputs[socket].links):
            material.node_tree.links.remove(link)
    shader.inputs['Roughness'].default_value = 0.87
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Specular IOR Level'].default_value = 0.22
    shader.inputs['Specular Tint'].default_value = (1, 1, 1, 1)
    if not shader.inputs['Base Color'].links:
        continue
    color_node = shader.inputs['Base Color'].links[0].from_node
    # Keep atlas resolution: this generated mesh has many tiny UV islands.
    # JPEG compression saves bandwidth without bleeding dark islands into skin.
    for node in list(nodes):
        if node.type == 'TEX_IMAGE' and node != color_node:
            nodes.remove(node)
    material.diffuse_color = (1, 1, 1, 1)

for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    before = len(obj.data.polygons)
    modifier = obj.modifiers.new('Web silhouette budget', 'DECIMATE')
    modifier.ratio = min(1, 65000 / before)
    # Apply only decimation, preserving the armature and vertex weights.
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print('Mesh faces:', before, '->', len(obj.data.polygons), flush=True)

output = os.path.join(root, 'assets/models/cheng607-mascot-web.glb')
bpy.ops.export_scene.gltf(
    filepath=output, export_format='GLB', export_animations=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_image_format='JPEG', export_jpeg_quality=85, export_apply=False,
    export_draco_texcoord_quantization=16, export_draco_normal_quantization=12,
    export_draco_position_quantization=16,
)
print('Web model:', os.path.getsize(output), 'bytes', flush=True)
