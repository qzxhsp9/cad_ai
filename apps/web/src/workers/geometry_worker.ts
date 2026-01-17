import { buildGeometryBuffers } from "../renderer/geometry_builder.js";
import {
  collectTransferables,
  GeometryWorkerMessage,
  GeometryWorkerRequest,
  serializeGeometryBuffers
} from "./geometry_worker_shared.js";

type WorkerContext = {
  postMessage: (
    message: GeometryWorkerMessage,
    transfer?: ArrayBufferLike[]
  ) => void;
  onmessage: ((event: { data: GeometryWorkerRequest }) => void) | null;
  close: () => void;
};

const ctx = globalThis as unknown as WorkerContext;

ctx.onmessage = (event) => {
  const payload = event.data;
  if (payload.type !== "build") {
    return;
  }

  try {
    const buffers = serializeGeometryBuffers(buildGeometryBuffers(payload.scene));
    const transfer = collectTransferables(buffers);
    ctx.postMessage({ type: "built", buffers }, transfer);
  } catch (error) {
    ctx.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Worker error"
    });
  }
};
