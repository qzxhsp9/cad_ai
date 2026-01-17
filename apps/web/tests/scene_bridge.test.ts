import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  createEmptySceneGraph,
  IncrementingIdFactory
} from "../src/core/index.js";
import { applyCommand } from "../src/state/index.js";
import { buildRenderBatches, renderScene } from "../src/renderer/index.js";

test("buildRenderBatches groups instances by mesh", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Bridge Test" });

  const command = {
    id: idFactory.nextCommandId(),
    type: "draw_line" as const,
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0] as [number, number, number],
    end: [1, 0, 0] as [number, number, number]
  };

  const result = applyCommand(scene, command, { idFactory });
  const batches = buildRenderBatches(result.scene);

  assert.equal(batches.length, 1);
  assert.equal(batches[0].instances.length, 16);
  assert.equal(batches[0].mesh.positions.length, 6);
});

test("renderScene invokes renderer with buffers", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Bridge Render" });

  const command = {
    id: idFactory.nextCommandId(),
    type: "draw_line" as const,
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0] as [number, number, number],
    end: [1, 0, 0] as [number, number, number]
  };

  const result = applyCommand(scene, command, { idFactory });

  const calls: Array<{ type: string }> = [];
  const renderer = {
    setMesh: () => {
      calls.push({ type: "mesh" });
    },
    setInstances: () => {
      calls.push({ type: "instances" });
    }
  };

  const batches = renderScene(result.scene, renderer);
  assert.equal(batches.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].type, "mesh");
  assert.equal(calls[1].type, "instances");
});
