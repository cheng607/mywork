# 3D mascot model

The portfolio loads the textured GLB `cheng607-mascot.glb` from this directory.

The current model keeps its original Draco-compressed mesh and textures. Four Blender-authored clips are embedded alongside the original `idle` clip:

- `scene_sit_down` and `scene_stand_up` transition between the standing home pose and the seated scenes.
- `scene_gaming_play` loops a controller-playing pose.
- `scene_dining_eat` loops a bite-and-rest motion.

## Regenerate the scene clips

Install Blender with its glTF 2.0 importer/exporter enabled, then run from the repository root:

```powershell
blender --background --factory-startup --python scripts/create_mascot_animations.py -- assets/models/cheng607-mascot.glb assets/models/cheng607-mascot.glb
```

The script exports a temporary Draco-compressed GLB, then merges only the animation samplers and channels into the original GLB. This keeps the source geometry, materials, textures, and compression intact. The input and output may be the same path.

This repository is published as a public portfolio. Confirm the model's license and required attribution before distributing it.
