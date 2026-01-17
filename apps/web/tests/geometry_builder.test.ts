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
    type: "draw_line" as const,
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0] as [number, number, number],
    end: [1, 0, 0] as [number, number, number]
  };

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

test("builds rect buffers from metadata", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Rect Buffers" });

  const command = {
    id: idFactory.nextCommandId(),
    type: "draw_rect" as const,
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0] as [number, number, number],
    width: 2,
    height: 1
  };

  const result = applyCommand(scene, command, { idFactory });
  const buffers = buildGeometryBuffers(result.scene);
  const meshId =
    result.scene.components.geometries[result.scene.entities[0].components.geometry!].mesh;

  assert.equal(buffers.meshes[meshId].positions.length, 12);
  assert.equal(buffers.meshes[meshId].indices.length, 8);
});

test("builds circle buffers from metadata", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Circle Buffers" });

  const command = {
    id: idFactory.nextCommandId(),
    type: "draw_circle" as const,
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0] as [number, number, number],
    radius: 1,
    segments: 8
  };

  const result = applyCommand(scene, command, { idFactory });
  const buffers = buildGeometryBuffers(result.scene);
  const meshId =
    result.scene.components.geometries[result.scene.entities[0].components.geometry!].mesh;

  assert.equal(buffers.meshes[meshId].positions.length, 24);
  assert.equal(buffers.meshes[meshId].indices.length, 16);
});

test("builds extrude buffers from profile metadata", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Extrude Buffers" });

  const rectCommand = {
    id: idFactory.nextCommandId(),
    type: "draw_rect" as const,
    createdAt: "2026-01-18T00:00:00Z",
    center: [0, 0, 0] as [number, number, number],
    width: 2,
    height: 1
  };

  const rectResult = applyCommand(scene, rectCommand, { idFactory });
  const profileId = rectResult.scene.entities[0].id;

  const extrudeCommand = {
    id: idFactory.nextCommandId(),
    type: "extrude" as const,
    createdAt: "2026-01-18T00:00:00Z",
    profileEntityId: profileId,
    height: 3
  };

  const extrudeResult = applyCommand(rectResult.scene, extrudeCommand, {
    idFactory
  });

  const buffers = buildGeometryBuffers(extrudeResult.scene);
  const meshId =
    extrudeResult.scene.components.geometries[extrudeResult.scene.entities[1].components.geometry!].mesh;

  assert.ok(buffers.meshes[meshId]);
  assert.equal(buffers.meshes[meshId].topology, "triangles");
});
