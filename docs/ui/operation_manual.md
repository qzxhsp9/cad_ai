# Web UI Operation Manual

This manual covers the interactive modeling UI in `apps/web`.

## Launch
1. `cd apps/web`
2. `npm install`
3. `npm run build`
4. `npm run serve`
5. Open `http://localhost:8080`

## Viewport controls
- Orbit: not available (2D canvas mode).
- Pan: hold `Shift` and drag, or use middle/right mouse button drag.
- Zoom: mouse wheel.
- Reset: refresh the page to reset view and scene.

## Tools
Use the left toolbar to switch tools:
- Select: click to select a shape, or drag to box-select.
- Line: click and drag to draw a line.
- Rectangle: click and drag to draw a rectangle.
- Circle: click and drag to draw a circle.

## Snapping
- Toggle snapping with the "Toggle Snapping" button.
- Snap targets include endpoints, corners, midpoints, perpendicular foot, and centers.
- Snap tolerance scales with zoom for consistent screen-space behavior.

## Selection and properties
- Selected entities are listed on the right panel.
- Selection highlights the bounds in green.
- Selection box highlights in cyan during drag.

## Extrusion (2.5D preview)
- Select a rectangle or circle.
- Set the "Extrude height" value.
- Click "Extrude Selection".
- The extrude preview is drawn as an offset outline.

## Undo/Redo
- Use "Undo" and "Redo" buttons in the left panel.

## Notes and limitations
- This UI is a 2D canvas preview (no WebGPU render yet).
- There is no file save/load in the current UI.
- Extrusion is a visual preview only; it does not generate meshes yet.
