import { buildGeometryBuffers } from "../renderer/geometry_builder.js";
import {
  collectTransferables,
  GeometryWorkerMessage,
  GeometryWorkerRequest,
  serializeGeometryBuffers
} from "./geometry_worker_shared.js";

type WorkerContext = {
  postMessage: (message: GeometryWorkerMessage, transfer?: ArrayBuffer[]) => void;
  onmessage: ((event: { data: GeometryWorkerRequest }) => void) | null;
  close: () => void;
};

const ctx = self as unknown as WorkerContext;

ctx.onmessage = (event) => {
  const payload = event.data;
  if (payload.type !== "build") {
    return;
  }

  try {
    const scene = payload.scene;
    const buffers = serializeGeometryBuffers(buildGeometryBuffers(scene));
    const transfer = collectTransferables(buffers);
    ctx.postMessage({ type: "built", buffers }, transfer);
  } catch (error) {
    ctx.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Worker error"
    });
  }
};
