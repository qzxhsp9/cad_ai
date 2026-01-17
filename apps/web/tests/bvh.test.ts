import * as assert from "node:assert/strict";
import { test } from "node:test";

import { createEmptySceneGraph, IncrementingIdFactory } from "../src/core/index.js";
import { applyCommand } from "../src/state/index.js";
import { buildBvh, buildEntityBounds, queryBox, queryPoint } from "../src/selection/bvh.js";

test("BVH point query finds entity", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "BVH Test" });

  const rect = {
    id: idFactory.nextCommandId(),
    type: "draw_rect" as const,
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0] as [number, number, number],
    width: 2,
    height: 2
  };

  const result = applyCommand(scene, rect, { idFactory });
  const items = buildEntityBounds(result.scene);
  const bvh = buildBvh(items);

  const hits = queryPoint(bvh, [0, 0, 0]);
  assert.equal(hits.length, 1);
});

test("BVH box query finds multiple entities", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "BVH Box" });

  const rectA = {
    id: idFactory.nextCommandId(),
    type: "draw_rect" as const,
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0] as [number, number, number],
    width: 2,
    height: 2
  };

  const rectB = {
    id: idFactory.nextCommandId(),
    type: "draw_rect" as const,
    createdAt: "2026-01-18T00:00:00Z",
    center: [5, 0, 0] as [number, number, number],
    width: 2,
    height: 2
  };

  const afterA = applyCommand(scene, rectA, { idFactory });
  const afterB = applyCommand(afterA.scene, rectB, { idFactory });
  const items = buildEntityBounds(afterB.scene);
  const bvh = buildBvh(items);

  const hits = queryBox(bvh, { min: [-1, -1, -1], max: [6, 1, 1] });
  assert.equal(hits.length, 2);
});
