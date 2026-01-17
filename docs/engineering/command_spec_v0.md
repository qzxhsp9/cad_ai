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
