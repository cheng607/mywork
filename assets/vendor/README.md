# Vendored Three.js

Version: 0.187.0, matching the site's previous CDN imports.
Source: https://registry.npmjs.org/three/-/three-0.187.0.tgz
License: MIT (see `three/LICENSE`).

Only the WebGL module, core, GLTF/Draco loaders, their utility dependencies, and
the glTF WASM decoder are included. These files are unmodified upstream assets.
Keeping them on the same origin removes the external CDN dependency at runtime.
