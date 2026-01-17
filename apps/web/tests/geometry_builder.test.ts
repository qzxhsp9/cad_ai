import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  createEmptySceneGraph,
  IncrementingIdFactory
} from "../src/core/index.js";
import { applyCommand } from "../src/state/index.js";
import { buildGeometryBuffers } from "../src/renderer/index.js";

test("builds line buffers from metadata", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Line Buffers" });

  const command = {
    id: idFactory.nextCommandId(),
    type: "draw_line",
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0],
    end: [1, 0, 0]
  } as const;

  const result = applyCommand(scene, command, { idFactory });
  const buffers = buildGeometryBuffers(result.scene);

  const meshId = result.scene.entities[0].components.geometry
    ? result.scene.components.geometries[result.scene.entities[0].components.geometry!].mesh
    : "";

  assert.ok(buffers.meshes[meshId]);
  assert.equal(buffers.meshes[meshId].positions.length, 6);
  assert.equal(buffers.meshes[meshId].indices.length, 2);
});

test("builds cube buffers from mesh source", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Cube Buffers" });

  const meshId = idFactory.nextAssetId();
  const geometryId = idFactory.nextComponentId();
  const entityId = idFactory.nextEntityId();

  scene.assets.meshes[meshId] = {
    id: meshId,
    name: "UnitCube",
    vertexCount: 8,
    indexCount: 36,
    indexFormat: "uint16",
    topology: "triangles",
    layout: {
      position: { offset: 0, stride: 12 }
    },
    sourceUri: "primitive:cube"
  };

  scene.components.geometries[geometryId] = {
    mesh: meshId,
    topology: "triangles"
  };

  scene.entities.push({
    id: entityId,
    name: "Cube",
    components: {
      geometry: geometryId
    }
  });

  const buffers = buildGeometryBuffers(scene);
  assert.equal(buffers.meshes[meshId].positions.length, 24);
  assert.equal(buffers.meshes[meshId].indices.length, 36);
});
