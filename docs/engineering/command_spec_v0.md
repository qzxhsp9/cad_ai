# Command execution spec (v0)

## Scope
Defines how `draw_line`, `transform`, and `delete` commands mutate the v0 SceneGraph,
including undo/redo payloads and validation rules.

## Common rules
- Commands are immutable inputs; execution creates a new SceneGraph snapshot.
- `updatedAt` is refreshed on every successful apply/undo.
- `IdFactory` is the source of new entity/component/asset IDs.

## draw_line
### Apply
- Create a new entity with:
  - `TransformComponent` initialized to identity.
  - `GeometryComponent` referencing a new mesh asset.
  - `MaterialComponent` with default material values.
  - `MetadataComponent` with:
    - `primitive = "line"`
    - `line.start.x|y|z`, `line.end.x|y|z`
- Create a new mesh asset:
  - `topology = "lines"`, `vertexCount = 2`, `indexCount = 2`
  - `indexFormat = "uint16"`
  - `layout.position = { offset: 0, stride: 12 }`
  - `sourceUri = "primitive:line"`
  - `bounds` computed from start/end

### Undo
- Remove the created entity, its components, and the mesh asset.

## draw_rect
### Apply
- Create a new entity with metadata:
  - `primitive = "rect"`
  - `rect.center.x|y|z`
  - `rect.width`, `rect.height`
- Create a new mesh asset:
  - `topology = "lines"` with 4 edges
  - `sourceUri = "primitive:rect"`
  - `bounds` computed from center/width/height

### Undo
- Remove the created entity, its components, and the mesh asset.

## draw_circle
### Apply
- Create a new entity with metadata:
  - `primitive = "circle"`
  - `circle.center.x|y|z`
  - `circle.radius`, `circle.segments`
- Create a new mesh asset:
  - `topology = "lines"` with approximated segments
  - `sourceUri = "primitive:circle"`
  - `bounds` computed from center/radius

### Undo
- Remove the created entity, its components, and the mesh asset.

## extrude
### Apply
- Read the profile entity metadata (`rect` or `circle`).
- Create a new mesh asset:
  - `topology = "triangles"`
  - `sourceUri = "primitive:extrude"`
  - `bounds` extended along +Z by `height`
- Create a new entity that references the extruded mesh asset.

### Undo
- Remove the created extrude entity, its components, and the mesh asset.

## transform
### Apply
- For each entity, update its `TransformComponent`.
- Translation is derived from the matrix `m[12..14]`.

### Undo
- Restore the previous transform for each entity.

## delete
### Apply
- Remove the specified entities.
- Remove all referenced components.
- Remove any mesh assets no longer referenced.

### Undo
- Restore removed entities, components, and assets.

## Validation rules
- Missing entity IDs are ignored for `transform` and `delete`.
- `draw_line` must include start/end vectors of length 3.
- `draw_rect` requires positive width/height.
- `draw_circle` requires positive radius and segments >= 3.
- `extrude` supports `rect` and `circle` profiles in v0.
