import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  createEmptySceneGraph,
  IncrementingIdFactory
} from "../src/core/index.js";
import { applyCommand } from "../src/state/index.js";
import {
  buildGeometryBuffersAsync,
  GeometryWorkerAdapter,
  GeometryWorkerFactory
} from "../src/renderer/index.js";
import {
  GeometryWorkerRequest,
  GeometryWorkerMessage,
  serializeGeometryBuffers
} from "../src/workers/geometry_worker_shared.js";
import { buildGeometryBuffers } from "../src/renderer/geometry_builder.js";

class FakeWorker implements GeometryWorkerAdapter {
  onmessage: ((event: { data: GeometryWorkerMessage }) => void) | null = null;

  postMessage(message: GeometryWorkerRequest): void {
    if (message.type !== "build") {
      return;
    }
    const buffers = serializeGeometryBuffers(buildGeometryBuffers(message.scene));
    this.onmessage?.({ data: { type: "built", buffers } });
  }

  terminate(): void {
    return;
  }
}

test("buildGeometryBuffersAsync uses worker factory", async () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Worker Buffers" });

  const command = {
    id: idFactory.nextCommandId(),
    type: "draw_line" as const,
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0] as [number, number, number],
    end: [1, 0, 0] as [number, number, number]
  };

  const result = applyCommand(scene, command, { idFactory });

  const factory: GeometryWorkerFactory = {
    create: () => new FakeWorker()
  };

  const buffers = await buildGeometryBuffersAsync(result.scene, { workerFactory: factory });
  const meshId =
    result.scene.components.geometries[result.scene.entities[0].components.geometry!].mesh;
  assert.ok(buffers.meshes[meshId]);
});
