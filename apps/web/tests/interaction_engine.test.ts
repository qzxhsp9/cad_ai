import * as assert from "node:assert/strict";
import { test } from "node:test";

import { createEmptySceneGraph, IncrementingIdFactory } from "../src/core/index.js";
import { InteractionEngine } from "../src/interaction/index.js";

test("interaction engine apply/select/snap/undo", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Interaction" });
  const engine = new InteractionEngine(scene, { idFactory });

  engine.apply({
    id: idFactory.nextCommandId(),
    type: "draw_rect",
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0],
    width: 2,
    height: 2
  });

  const selected = engine.selectPoint([0, 0, 0]);
  assert.equal(selected.length, 1);

  const snap = engine.snap([1, 1, 0], 0.5);
  assert.ok(snap);
  assert.equal(snap?.type, "corner");

  engine.undo();
  assert.equal(engine.scene.entities.length, 0);
});

test("interaction engine extrude selection", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Extrude" });
  const engine = new InteractionEngine(scene, { idFactory });

  engine.apply({
    id: idFactory.nextCommandId(),
    type: "draw_rect",
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0],
    width: 2,
    height: 1
  });

  engine.selectPoint([0, 0, 0]);
  engine.extrudeSelection(3);

  assert.equal(engine.scene.entities.length, 2);
});

test("interaction engine resolves picking color", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Picking" });
  const engine = new InteractionEngine(scene, { idFactory });

  engine.apply({
    id: idFactory.nextCommandId(),
    type: "draw_line",
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0],
    end: [1, 0, 0]
  });

  const entityId = engine.scene.entities[0].id;
  const color = { r: 1 / 255, g: 0, b: 0, a: 1 };
  const resolved = engine.resolvePickingColor(color);

  assert.equal(resolved, entityId);
});
