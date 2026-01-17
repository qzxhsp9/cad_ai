import assert from "node:assert/strict";
import test from "node:test";

import {
  Command,
  createEmptySceneGraph,
  IncrementingIdFactory
} from "../src/core/index.js";
import { applyCommand, undoCommand } from "../src/state/index.js";

test("draw_line apply and undo", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Spec Test" });

  const command: Command = {
    id: idFactory.nextCommandId(),
    type: "draw_line",
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0],
    end: [2, 0, 0]
  };

  const result = applyCommand(scene, command, {
    idFactory,
    now: () => "2026-01-18T00:00:01Z"
  });

  assert.equal(result.scene.entities.length, 1);
  assert.equal(result.scene.metadata.updatedAt, "2026-01-18T00:00:01Z");
  assert.ok(result.undo);

  const entity = result.scene.entities[0];
  assert.ok(entity.components.geometry);
  assert.ok(entity.components.metadata);

  const geometry = result.scene.components.geometries[entity.components.geometry!];
  assert.equal(geometry.topology, "lines");
  assert.equal(geometry.mesh in result.scene.assets.meshes, true);

  const metadata = result.scene.components.metadata[entity.components.metadata!];
  assert.equal(metadata.properties.primitive, "line");
  assert.equal(metadata.properties["line.end.x"], 2);

  const undone = undoCommand(result.scene, result.undo, {
    idFactory,
    now: () => "2026-01-18T00:00:02Z"
  });

  assert.equal(undone.entities.length, 0);
  assert.equal(undone.metadata.updatedAt, "2026-01-18T00:00:02Z");
});
