import { OrbitCamera } from "./core/camera.js";
import { Matrix4 } from "./core/matrix4.js";
import { Mesh } from "./core/mesh.js";
import { RenderScheduler } from "./renderer/render_scheduler.js";
import { Renderer } from "./renderer/renderer.js";
import { WebGpuRenderer } from "./renderer/webgpu_renderer.js";
import { WebGl2Renderer } from "./renderer/webgl2_renderer.js";

const GRID_X = 100;
const GRID_Y = 100;
const GRID_Z = 10;
const SPACING = 2.0;
const SCALE = 0.9;

async function main(): Promise<void> {
  const canvas = document.getElementById("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Canvas element not found.");
  }

  const overlay = document.getElementById("overlay");
  const { renderer, label } = await createRenderer(canvas);

  const mesh = Mesh.createCube(1);
  renderer.setMesh(mesh);

  const instances = createInstanceMatrices(GRID_X, GRID_Y, GRID_Z, SPACING, SCALE);
  renderer.setInstances(instances.matrices);

  if (overlay) {
    overlay.textContent = `${label} | Instances: ${instances.count}`;
  }

  const camera = new OrbitCamera();
  const view = new Matrix4();
  const projection = new Matrix4();
  const viewProjection = new Matrix4();

  const scheduler = new RenderScheduler(() => {
    const { width, height, devicePixelRatio } = resizeCanvasToDisplaySize(canvas);
    renderer.resize(width, height, devicePixelRatio);

    const aspect = width / Math.max(1, height);
    camera.getProjectionMatrix(aspect, projection);
    camera.getViewMatrix(view);
    Matrix4.multiply(projection, view, viewProjection);
    renderer.render(viewProjection.elements);
  });

  setupInput(canvas, camera, scheduler);
  window.addEventListener("resize", () => scheduler.invalidate());
  scheduler.invalidate();
}

async function createRenderer(
  canvas: HTMLCanvasElement
): Promise<{ renderer: Renderer; label: string }> {
  if ("gpu" in navigator) {
    try {
      const webgpu = new WebGpuRenderer();
      await webgpu.initialize(canvas);
      return { renderer: webgpu, label: "WebGPU" };
    } catch (error) {
      console.warn("WebGPU initialization failed, falling back to WebGL2.", error);
    }
  }

  const webgl = new WebGl2Renderer();
  await webgl.initialize(canvas);
  return { renderer: webgl, label: "WebGL2" };
}

function setupInput(
  canvas: HTMLCanvasElement,
  camera: OrbitCamera,
  scheduler: RenderScheduler
): void {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let mode: "orbit" | "pan" = "orbit";

  canvas.addEventListener("pointerdown", (event) => {
    isDragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    mode = event.shiftKey || event.button === 2 ? "pan" : "orbit";
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    if (mode === "orbit") {
      camera.orbit(dx * 0.005, dy * 0.005);
    } else {
      camera.pan(dx, dy);
    }
    scheduler.invalidate();
  });

  const endDrag = (event: PointerEvent) => {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    canvas.releasePointerCapture(event.pointerId);
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      camera.zoom(event.deltaY * 0.001);
      scheduler.invalidate();
    },
    { passive: false }
  );
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): {
  width: number;
  height: number;
  devicePixelRatio: number;
} {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.clientWidth * devicePixelRatio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * devicePixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, devicePixelRatio };
}

function createInstanceMatrices(
  gridX: number,
  gridY: number,
  gridZ: number,
  spacing: number,
  scale: number
): { matrices: Float32Array; count: number } {
  const count = gridX * gridY * gridZ;
  const matrices = new Float32Array(count * 16);

  const offsetX = -((gridX - 1) * spacing) * 0.5;
  const offsetY = -((gridY - 1) * spacing) * 0.5;
  const offsetZ = -((gridZ - 1) * spacing) * 0.5;

  let index = 0;
  for (let z = 0; z < gridZ; z += 1) {
    for (let y = 0; y < gridY; y += 1) {
      for (let x = 0; x < gridX; x += 1) {
        const tx = offsetX + x * spacing;
        const ty = offsetY + y * spacing;
        const tz = offsetZ + z * spacing;
        writeInstanceMatrix(matrices, index * 16, tx, ty, tz, scale);
        index += 1;
      }
    }
  }

  return { matrices, count };
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

main().catch((error) => {
  console.error(error);
});
