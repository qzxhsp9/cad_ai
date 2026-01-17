import { SceneGraph } from "../core/index.js";
import { buildGeometryBuffers, GeometryBufferMap } from "./geometry_builder.js";
import {
  deserializeGeometryBuffers,
  GeometryWorkerMessage,
  GeometryWorkerRequest
} from "../workers/geometry_worker_shared.js";

export interface GeometryWorkerAdapter {
  postMessage(message: GeometryWorkerRequest, transfer?: ArrayBufferLike[]): void;
  terminate(): void;
  onmessage: ((event: { data: GeometryWorkerMessage }) => void) | null;
}

export interface GeometryWorkerFactory {
  create(): GeometryWorkerAdapter;
}

export async function buildGeometryBuffersAsync(
  scene: SceneGraph,
  options: { workerFactory?: GeometryWorkerFactory; timeoutMs?: number } = {}
): Promise<GeometryBufferMap> {
  const { workerFactory, timeoutMs = 5000 } = options;
  const factory = workerFactory ?? defaultFactory();
  if (!factory) {
    return buildGeometryBuffers(scene);
  }

  const worker = factory.create();
  try {
    const response = await new Promise<GeometryWorkerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Geometry worker timed out."));
      }, timeoutMs);

      worker.onmessage = (event) => {
        const message = event.data;
        if (message.type === "error") {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(message.message));
          return;
        }
        if (message.type === "built") {
          clearTimeout(timeout);
          resolve(message);
        }
      };

      worker.postMessage({ type: "build", scene });
    });

    if (response.type !== "built") {
      throw new Error("Unexpected worker response.");
    }

    return deserializeGeometryBuffers(response.buffers);
  } finally {
    worker.terminate();
  }
}

function defaultFactory(): GeometryWorkerFactory | null {
  const WorkerCtor = (globalThis as {
    Worker?: new (url: URL, options?: { type: "module" }) => GeometryWorkerAdapter;
  }).Worker;
  if (!WorkerCtor) {
    return null;
  }

  return {
    create: () =>
      new WorkerCtor(new URL("../workers/geometry_worker.js", import.meta.url), {
        type: "module"
      })
  };
}
