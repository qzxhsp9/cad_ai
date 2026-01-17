import { GridConfig, WorkerRequest, WorkerResponse } from "./worker_types.js";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data;
  if (payload.type === "dispose") {
    ctx.close();
    return;
  }
  if (payload.type !== "generate") {
    return;
  }

  try {
    const { grid, buffer } = payload;
    const matrices = buffer
      ? new Float32Array(buffer)
      : new Float32Array(grid.x * grid.y * grid.z * 16);

    fillMatrices(matrices, grid);

    const response: WorkerResponse = {
      type: "generated",
      count: grid.x * grid.y * grid.z,
      buffer: matrices.buffer,
      shared: Boolean(buffer)
    };

    if (buffer) {
      ctx.postMessage(response);
    } else {
      ctx.postMessage(response, [matrices.buffer]);
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: "error",
      message: error instanceof Error ? error.message : "Worker error"
    };
    ctx.postMessage(response);
  }
};

function fillMatrices(target: Float32Array, grid: GridConfig): void {
  const count = grid.x * grid.y * grid.z;
  const offsetX = -((grid.x - 1) * grid.spacing) * 0.5;
  const offsetY = -((grid.y - 1) * grid.spacing) * 0.5;
  const offsetZ = -((grid.z - 1) * grid.spacing) * 0.5;

  let index = 0;
  for (let z = 0; z < grid.z; z += 1) {
    for (let y = 0; y < grid.y; y += 1) {
      for (let x = 0; x < grid.x; x += 1) {
        const tx = offsetX + x * grid.spacing;
        const ty = offsetY + y * grid.spacing;
        const tz = offsetZ + z * grid.spacing;
        writeInstanceMatrix(target, index * 16, tx, ty, tz, grid.scale);
        index += 1;
      }
    }
  }

  if (index !== count) {
    throw new Error("Instance count mismatch.");
  }
}

function writeInstanceMatrix(
  target: Float32Array,
  offset: number,
  tx: number,
  ty: number,
  tz: number,
  scale: number
): void {
  target[offset + 0] = scale;
  target[offset + 1] = 0;
  target[offset + 2] = 0;
  target[offset + 3] = 0;
  target[offset + 4] = 0;
  target[offset + 5] = scale;
  target[offset + 6] = 0;
  target[offset + 7] = 0;
  target[offset + 8] = 0;
  target[offset + 9] = 0;
  target[offset + 10] = scale;
  target[offset + 11] = 0;
  target[offset + 12] = tx;
  target[offset + 13] = ty;
  target[offset + 14] = tz;
  target[offset + 15] = 1;
}
