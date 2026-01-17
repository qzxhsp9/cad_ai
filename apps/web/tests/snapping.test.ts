import * as assert from "node:assert/strict";
import { test } from "node:test";

import { createEmptySceneGraph, IncrementingIdFactory } from "../src/core/index.js";
import { applyCommand } from "../src/state/index.js";
import { computeSnap } from "../src/interaction/snapping.js";

test("snaps to line endpoint", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Snap Line" });

  const line = {
    id: idFactory.nextCommandId(),
    type: "draw_line" as const,
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0] as [number, number, number],
    end: [10, 0, 0] as [number, number, number]
  };

  const result = applyCommand(scene, line, { idFactory });
  const snap = computeSnap(result.scene, [9.8, 0.1, 0], 0.5);

  assert.ok(snap);
  assert.equal(snap?.type, "endpoint");
});

test("snaps to perpendicular foot", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Snap Perp" });

  const line = {
    id: idFactory.nextCommandId(),
    type: "draw_line" as const,
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0] as [number, number, number],
    end: [10, 0, 0] as [number, number, number]
  };

  const result = applyCommand(scene, line, { idFactory });
  const snap = computeSnap(result.scene, [3, 2, 0], 3);

  assert.ok(snap);
  assert.equal(snap?.type, "perpendicular");
  assert.deepEqual(snap?.position, [3, 0, 0]);
});

test("snaps to rect corner", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Snap Rect" });

  const rect = {
    id: idFactory.nextCommandId(),
    type: "draw_rect" as const,
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0] as [number, number, number],
    width: 2,
    height: 2
  };

  const result = applyCommand(scene, rect, { idFactory });
  const snap = computeSnap(result.scene, [1, 1, 0], 0.5);

  assert.ok(snap);
  assert.equal(snap?.type, "corner");
});
