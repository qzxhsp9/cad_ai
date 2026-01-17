# Post-P1 execution plan

## Goal
Move from POC rendering to a minimal SceneGraph-driven editor loop.

## Planned order (after P1)
1. ISSUE-0004: Define command execution spec.
   - Deliverables: command mutation rules for draw/transform/delete; undo/redo data.
   - Verification: spec doc + TypeScript stubs compiled.
2. ISSUE-0005: SceneGraph command executor.
   - Deliverables: executor applying commands to SceneGraph; unit tests.
   - Verification: test suite passes for basic command flows.
3. ISSUE-0006: Geometry buffer builder.
   - Deliverables: SceneGraph mesh asset -> GPU buffers mapping.
   - Verification: sample mesh builds buffers and matches layout.
4. ISSUE-0007: Renderer bridge wiring.
   - Deliverables: render loop consumes SceneGraph buffers without manual mesh setup.
   - Verification: baseline scene renders via SceneGraph-only setup.

## Dependencies
- ISSUE-0010 (wasm-pack pipeline) remains blocked until Cargo edition2024 support is available.
