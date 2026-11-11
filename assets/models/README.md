# 3D mascot model

The page loads `cheng607-mascot-web.glb` (about 2.0 MB, 64,998 triangles). The
original `cheng607-mascot.glb` is retained as an archival source and is not copied
to the published site.

The web build keeps the original character and skeleton, reduces mesh density,
removes the generated normal/specular maps, and compresses the color atlas as
JPEG. Its 4K atlas resolution and 16-bit UV quantization preserve small UV islands.
The old scene animation clips are excluded. `mascot-rig.js` builds complete poses
from rest transforms using world-space limb directions, then interpolates poses.
This avoids assuming that left and right Mixamo bones share the same local axes.

## Regenerate the web model

With Blender 5.2 and its glTF importer/exporter installed, run from the repository
root:

```powershell
blender --background --factory-startup --python scripts/optimize_mascot.py
```

The command reads the archival GLB and writes only the web GLB. It does not alter
the archival model. Static transparent previews in `assets/mascot/` are rendered
from the web model in its three scene poses. Update those when the model or pose
layout changes.

The archival model was generated with Tencent Hunyuan 3D and rigged with Mixamo.
The historical `create_mascot_animations.py` script is retained for reference;
its generated clips are no longer used by the page.
