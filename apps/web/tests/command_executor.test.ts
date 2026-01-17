import * as assert from "node:assert/strict";
import { test } from "node:test";

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

test("transform apply and undo", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Transform Test" });

  const lineCommand: Command = {
    id: idFactory.nextCommandId(),
    type: "draw_line",
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0],
    end: [1, 0, 0]
  };

  const lineResult = applyCommand(scene, lineCommand, {
    idFactory,
    now: () => "2026-01-18T00:00:01Z"
  });

  const entity = lineResult.scene.entities[0];
  const transformId = entity.components.transform!;
  const transformBefore = lineResult.scene.components.transforms[transformId];

  const transformCommand: Command = {
    id: idFactory.nextCommandId(),
    type: "transform",
    createdAt: "2026-01-18T00:00:02Z",
    entityIds: [entity.id],
    matrix: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      5, 6, 7, 1
    ]
  };

  const transformResult = applyCommand(lineResult.scene, transformCommand, {
    idFactory,
    now: () => "2026-01-18T00:00:03Z"
  });

  const transformAfter =
    transformResult.scene.components.transforms[transformId];
  assert.deepEqual(transformAfter.position, [5, 6, 7]);

  const restored = undoCommand(transformResult.scene, transformResult.undo, {
    idFactory,
    now: () => "2026-01-18T00:00:04Z"
  });

  const transformRestored = restored.components.transforms[transformId];
  assert.deepEqual(transformRestored.position, transformBefore.position);
});

test("delete apply and undo", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Delete Test" });

  const lineCommand: Command = {
    id: idFactory.nextCommandId(),
    type: "draw_line",
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0],
    end: [1, 0, 0]
  };

  const lineResult = applyCommand(scene, lineCommand, {
    idFactory,
    now: () => "2026-01-18T00:00:01Z"
  });

  const entityId = lineResult.scene.entities[0].id;
  const deleteCommand: Command = {
    id: idFactory.nextCommandId(),
    type: "delete",
    createdAt: "2026-01-18T00:00:02Z",
    entityIds: [entityId]
  };

  const deleteResult = applyCommand(lineResult.scene, deleteCommand, {
    idFactory,
    now: () => "2026-01-18T00:00:03Z"
  });

  assert.equal(deleteResult.scene.entities.length, 0);

  const restored = undoCommand(deleteResult.scene, deleteResult.undo, {
    idFactory,
    now: () => "2026-01-18T00:00:04Z"
  });

  assert.equal(restored.entities.length, 1);
});
