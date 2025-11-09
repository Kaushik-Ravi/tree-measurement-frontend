# Distance Marker 3D Model

## Model Requirements

For the AR distance measurement to work, we need a simple 3D marker model in GLB format.

### Option 1: Use Free Model (Recommended for Testing)
Download a free marker/pin model from:
- https://poly.pizza (Free 3D models)
- https://sketchfab.com (Search "location pin" or "marker")
- https://www.cgtrader.com/free-3d-models

### Option 2: Create Custom Model (Production)
Use Blender (free) to create a simple cylinder/cone:

1. Download Blender: https://www.blender.org/
2. Create a simple cone shape (File → New → General)
3. Delete the default cube
4. Add → Mesh → Cone
5. Scale to reasonable size (S key, then type 0.5)
6. File → Export → glTF 2.0 (.glb)
7. Save as `distance-marker.glb`

### Model Specifications:
- Format: GLB (binary glTF)
- Size: < 100KB
- Units: Meters
- Scale: 1 unit = 1 meter in AR
- Centered at origin (0, 0, 0)

### Installation:
Place the model file at:
```
FrontEnd/project-bolt-sb1-k44zmwc9/project/public/models/distance-marker.glb
```

## Temporary Placeholder

For immediate testing, model-viewer can work without a model (will show a placeholder).
The AR functionality will still work for distance measurement.

## Alternative: Inline GLB

You can also use a data URI with a minimal embedded model.
See: https://modelviewer.dev/examples/loading/
