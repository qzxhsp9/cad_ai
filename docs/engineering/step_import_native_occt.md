# Native OCCT STEP Import → 3D View Plan

This plan targets **Option A: native OCCT** and focuses on validating STEP import in the web 3D view.

## Goal
Import a STEP file using native OCCT and visualize its output in the web 3D view to confirm geometry correctness.

## Architecture overview
1. **Native OCCT service (local)** loads STEP and tessellates shapes.
2. **Web app** uploads STEP and receives mesh/edge data.
3. **3D view** renders the returned geometry for verification.

## Service responsibilities (native OCCT)
- Load STEP: `STEPControl_Reader`.
- Build TopoDS shape: `reader.TransferRoots()` + `OneShape()`.
- Mesh/tessellate: `BRepMesh_IncrementalMesh`.
- Extract:
  - Triangle meshes (positions + normals).
  - Optional edges/lines for silhouette/feature display.
- Compute bounds for camera framing.

## Proposed data contract
**POST** `/api/step/import` (multipart form)
- Body: `file=<step>` plus optional `unit=mm|m`, `tessellation=...`.
- Response: `{ modelId, bounds, meshCount }`

**GET** `/api/step/models/{id}`
- Response:
```
{
  "bounds": { "min": [x,y,z], "max": [x,y,z] },
  "meshes": [
    {
      "id": "mesh-1",
      "positions": [x,y,z,...],
      "normals": [x,y,z,...],
      "indices": [i0,i1,i2,...]
    }
  ],
  "edges": [
    { "positions": [x,y,z,...] }
  ]
}
```

## Web app integration steps
1. Add a **STEP import UI** (file picker + upload button).
2. Upload file to `/api/step/import`.
3. Fetch model data from `/api/step/models/{id}`.
4. Convert to render buffers for the 3D view (triangle list + edge lines).
5. Frame camera to returned bounds.

## Local service implementation
- Location: `apps/occt-service`
- Start: `npm install` then `npm run start`
- Port: `7071` by default (override with `PORT`).
- OCCT CLI path: set `OCCT_CLI=/path/to/occt_step_export`.

## OCCT CLI build (C++)
- Source: `apps/occt-service/occt_cli`
- Configure:
  1. `cmake -S . -B build -DOpenCASCADE_DIR=<path>`
  2. `cmake --build build --config Release`
- Binary: `build/occt_step_export`
- Arguments: `occt_step_export <file.step> --deflection 0.1 --angle 0.5 --unit mm`

## 3D view rendering plan
- Triangles: shaded or flat color for surface validation.
- Edges: optional line overlay for feature visibility.
- Materials: single default for now.

## Validation checklist
1. Service loads STEP without errors.
2. Mesh count and triangle counts are non-zero.
3. Bounds are valid (min < max on all axes).
4. 3D view frames the model correctly.
5. Visual inspection: no missing faces, no flipped normals.
6. Compare dimensions to known CAD values (if available).
7. Rotate/pan/zoom to inspect hidden surfaces.

## Suggested test artifacts
- A simple STEP box and cylinder.
- A medium-complexity mechanical part (fillets + holes).
- One large assembly (for performance spot check).

## Notes
- Use mm→m scaling if STEP units are in millimeters.
- For faster iteration, start with low tessellation and increase later.
- Keep service local initially to avoid network delay during validation.
