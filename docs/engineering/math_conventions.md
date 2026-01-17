# Math conventions (v0)

## Coordinate system
- Right-handed world coordinates.
- +X is right, +Y is up, +Z is forward in world space.
- View space uses a camera that looks down -Z.

## Matrix storage and multiplication
- Matrices are column-major arrays (indices 0..3 are column 0).
- Vectors are column vectors; transforms are applied as `M * v`.
- `Matrix4.multiply(a, b)` returns `a * b` and preserves `identity * B = B`.

## Camera lookAt
- `zAxis = normalize(eye - target)`
- `xAxis = normalize(cross(up, zAxis))`
- `yAxis = cross(zAxis, xAxis)`
- Basis vectors are stored as columns.

## Projection and depth ranges
- WebGL2 uses depth range -1..1.
- WebGPU uses depth range 0..1.
- The `depthZeroToOne` flag in `Matrix4.perspective` selects the correct range.

## Winding and culling
- Front faces are counter-clockwise (CCW) by default.
- Back-face culling is enabled for WebGPU unless explicitly disabled.
