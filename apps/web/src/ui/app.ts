import { Command, createEmptySceneGraph, IncrementingIdFactory, Vector3 } from "../core/index.js";
import { InteractionEngine } from "../interaction/index.js";

type Tool = "select" | "line" | "rect" | "circle";

const TOOL_LABELS: Record<Tool, string> = {
  select: "Select",
  line: "Line",
  rect: "Rectangle",
  circle: "Circle"
};

function getCanvas(selector: string): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>(selector);
  if (!element) {
    throw new Error("Viewport canvas not found.");
  }
  return element;
}

function getCanvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext("2d");
  if (!context) {
    throw new Error("Unable to get 2D context.");
  }
  return context;
}

const canvas = getCanvas("#viewport");

const modeStatus = document.getElementById("modeStatus");
const snapStatus = document.getElementById("snapStatus");
const sceneStatus = document.getElementById("sceneStatus");
const selectionList = document.getElementById("selectionList");
const toolList = document.getElementById("toolList");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const snapToggle = document.getElementById("snapToggle");
const extrudeBtn = document.getElementById("extrudeBtn");
const extrudeHeightInput = document.getElementById("extrudeHeight");

const ctx = getCanvasContext(canvas);

const idFactory = new IncrementingIdFactory("web");
const engine = new InteractionEngine(createEmptySceneGraph({ name: "MVP" }), {
  idFactory
});

const state = {
  tool: "select" as Tool,
  snapping: true,
  isDragging: false,
  isPanning: false,
  dragStart: null as Vector3 | null,
  hoverPoint: null as Vector3 | null,
  selectionBox: null as { min: Vector3; max: Vector3 } | null,
  panStart: null as { x: number; y: number; centerX: number; centerY: number } | null,
  viewport: {
    width: 0,
    height: 0,
    pixelRatio: 1
  },
  camera: {
    centerX: 0,
    centerY: 0,
    scale: 40
  }
};

function init(): void {
  setupTools();
  setupEvents();
  resizeCanvas();
  render();
}

function setupTools(): void {
  if (!toolList) {
    return;
  }
  toolList.innerHTML = "";
  (Object.keys(TOOL_LABELS) as Tool[]).forEach((tool) => {
    const button = document.createElement("button");
    button.textContent = TOOL_LABELS[tool];
    button.className = tool === state.tool ? "active" : "";
    button.addEventListener("click", () => {
      state.tool = tool;
      updateStatus();
      setupTools();
    });
    toolList.appendChild(button);
  });
}

function setupEvents(): void {
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  undoBtn?.addEventListener("click", () => {
    engine.undo();
    render();
  });
  redoBtn?.addEventListener("click", () => {
    engine.redo();
    render();
  });
  snapToggle?.addEventListener("click", () => {
    state.snapping = !state.snapping;
    updateStatus();
  });
  extrudeBtn?.addEventListener("click", () => {
    const value = Number(extrudeHeightInput instanceof HTMLInputElement ? extrudeHeightInput.value : 0);
    if (Number.isFinite(value) && value > 0) {
      engine.extrudeSelection(value);
      render();
    }
  });
}

function updateStatus(): void {
  if (modeStatus) {
    modeStatus.textContent = `Mode: ${TOOL_LABELS[state.tool]}`;
  }
  if (snapStatus) {
    snapStatus.textContent = `Snapping: ${state.snapping ? "On" : "Off"}`;
  }
}

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  state.viewport.width = rect.width;
  state.viewport.height = rect.height;
  state.viewport.pixelRatio = ratio;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  render();
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 1.1 : 0.9;
  state.camera.scale = Math.max(10, Math.min(200, state.camera.scale * delta));
  render();
}

function onPointerDown(event: PointerEvent): void {
  if (event.button === 1 || event.shiftKey) {
    state.isPanning = true;
    state.panStart = {
      x: event.clientX,
      y: event.clientY,
      centerX: state.camera.centerX,
      centerY: state.camera.centerY
    };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  state.isDragging = true;
  const point = screenToWorld(event.offsetX, event.offsetY);
  state.dragStart = point;
  if (state.tool === "select") {
    state.selectionBox = null;
  }
}

function onPointerMove(event: PointerEvent): void {
  if (state.isPanning && state.panStart) {
    const dx = (event.clientX - state.panStart.x) / state.camera.scale;
    const dy = (event.clientY - state.panStart.y) / state.camera.scale;
    state.camera.centerX = state.panStart.centerX - dx;
    state.camera.centerY = state.panStart.centerY + dy;
    render();
    return;
  }
  const point = screenToWorld(event.offsetX, event.offsetY);
  state.hoverPoint = point;
  if (!state.isDragging || !state.dragStart) {
    render();
    return;
  }

  if (state.tool === "select") {
    state.selectionBox = {
      min: [
        Math.min(state.dragStart[0], point[0]),
        Math.min(state.dragStart[1], point[1]),
        0
      ],
      max: [
        Math.max(state.dragStart[0], point[0]),
        Math.max(state.dragStart[1], point[1]),
        0
      ]
    };
  }

  render();
}

function onPointerUp(event: PointerEvent): void {
  if (state.isPanning) {
    state.isPanning = false;
    state.panStart = null;
    canvas.releasePointerCapture(event.pointerId);
    render();
    return;
  }
  const point = screenToWorld(event.offsetX, event.offsetY);
  const snap = state.snapping ? engine.snap(point, 0.2) : null;
  const finalPoint = snap ? snap.position : point;

  if (!state.dragStart) {
    state.isDragging = false;
    return;
  }

  if (state.tool === "line") {
    const command: Command = {
      id: idFactory.nextCommandId(),
      createdAt: new Date().toISOString(),
      type: "draw_line",
      start: state.dragStart,
      end: finalPoint
    };
    engine.apply(command);
  }

  if (state.tool === "rect") {
    const center: Vector3 = [
      (state.dragStart[0] + finalPoint[0]) * 0.5,
      (state.dragStart[1] + finalPoint[1]) * 0.5,
      0
    ];
    const command: Command = {
      id: idFactory.nextCommandId(),
      createdAt: new Date().toISOString(),
      type: "draw_rect",
      center,
      width: Math.abs(finalPoint[0] - state.dragStart[0]),
      height: Math.abs(finalPoint[1] - state.dragStart[1])
    };
    engine.apply(command);
  }

  if (state.tool === "circle") {
    const dx = finalPoint[0] - state.dragStart[0];
    const dy = finalPoint[1] - state.dragStart[1];
    const command: Command = {
      id: idFactory.nextCommandId(),
      createdAt: new Date().toISOString(),
      type: "draw_circle",
      center: state.dragStart,
      radius: Math.max(0.1, Math.hypot(dx, dy)),
      segments: 48
    };
    engine.apply(command);
  }

  if (state.tool === "select") {
    if (state.selectionBox) {
      engine.selectBox(state.selectionBox);
    } else {
      engine.selectPoint(finalPoint);
    }
  }

  state.isDragging = false;
  state.dragStart = null;
  state.selectionBox = null;
  render();
}

function screenToWorld(x: number, y: number): Vector3 {
  const rect = canvas.getBoundingClientRect();
  return [
    (x - rect.width * 0.5) / state.camera.scale + state.camera.centerX,
    (rect.height * 0.5 - y) / state.camera.scale + state.camera.centerY,
    0
  ];
}

function worldToScreen(point: Vector3): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    rect.width * 0.5 + (point[0] - state.camera.centerX) * state.camera.scale,
    rect.height * 0.5 - (point[1] - state.camera.centerY) * state.camera.scale
  ];
}

function render(): void {
  ctx.setTransform(state.viewport.pixelRatio, 0, 0, state.viewport.pixelRatio, 0, 0);
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  ctx.save();
  ctx.translate(state.viewport.width / 2, state.viewport.height / 2);
  ctx.scale(state.camera.scale, -state.camera.scale);
  ctx.translate(-state.camera.centerX, -state.camera.centerY);

  drawGrid();
  drawScene();
  drawPreview();
  drawSelection();
  drawSnap();

  ctx.restore();
  updateSelectionList();
  updateStatus();
  if (sceneStatus) {
    sceneStatus.textContent = `Entities: ${engine.scene.entities.length} | Selected: ${engine.selected.length}`;
  }
}

function drawGrid(): void {
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1 / state.camera.scale;
  const size = 50;
  for (let i = -size; i <= size; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-size, i);
    ctx.lineTo(size, i);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, -size);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
}

function drawScene(): void {
  const scene = engine.scene;
  for (const entity of scene.entities) {
    const metadataId = entity.components.metadata;
    if (!metadataId) {
      continue;
    }
    const metadata = scene.components.metadata[metadataId];
    if (!metadata) {
      continue;
    }
    const primitive = metadata.properties.primitive;
    ctx.strokeStyle = "#7aa2ff";
    ctx.lineWidth = 2 / state.camera.scale;

    if (primitive === "line") {
      const start = readVec3(metadata, "line.start");
      const end = readVec3(metadata, "line.end");
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start[0], start[1]);
        ctx.lineTo(end[0], end[1]);
        ctx.stroke();
      }
    }

    if (primitive === "rect") {
      const center = readVec3(metadata, "rect.center");
      const width = Number(metadata.properties["rect.width"] ?? 0);
      const height = Number(metadata.properties["rect.height"] ?? 0);
      if (center) {
        ctx.strokeRect(
          center[0] - width * 0.5,
          center[1] - height * 0.5,
          width,
          height
        );
      }
    }

    if (primitive === "circle") {
      const center = readVec3(metadata, "circle.center");
      const radius = Number(metadata.properties["circle.radius"] ?? 0);
      if (center) {
        ctx.beginPath();
        ctx.arc(center[0], center[1], radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (primitive === "extrude") {
      const height = Number(metadata.properties["extrude.height"] ?? 0);
      const min = readVec3(metadata, "profile.min");
      const max = readVec3(metadata, "profile.max");
      if (min && max) {
        const dx = height * 0.2;
        const dy = height * 0.2;
        ctx.strokeRect(min[0], min[1], max[0] - min[0], max[1] - min[1]);
        ctx.strokeRect(min[0] + dx, min[1] + dy, max[0] - min[0], max[1] - min[1]);
        ctx.beginPath();
        ctx.moveTo(min[0], min[1]);
        ctx.lineTo(min[0] + dx, min[1] + dy);
        ctx.moveTo(max[0], min[1]);
        ctx.lineTo(max[0] + dx, min[1] + dy);
        ctx.moveTo(max[0], max[1]);
        ctx.lineTo(max[0] + dx, max[1] + dy);
        ctx.moveTo(min[0], max[1]);
        ctx.lineTo(min[0] + dx, max[1] + dy);
        ctx.stroke();
      }
    }
  }
}

function drawPreview(): void {
  if (!state.dragStart || !state.isDragging || state.tool === "select") {
    return;
  }
  ctx.strokeStyle = "#ffd36a";
  ctx.lineWidth = 2 / state.camera.scale;
  const point = state.hoverPoint ?? state.dragStart;

  if (state.tool === "line") {
    ctx.beginPath();
    ctx.moveTo(state.dragStart[0], state.dragStart[1]);
    ctx.lineTo(point[0], point[1]);
    ctx.stroke();
  }

  if (state.tool === "rect") {
    const center: Vector3 = [
      (state.dragStart[0] + point[0]) * 0.5,
      (state.dragStart[1] + point[1]) * 0.5,
      0
    ];
    ctx.strokeRect(
      center[0] - Math.abs(point[0] - state.dragStart[0]) * 0.5,
      center[1] - Math.abs(point[1] - state.dragStart[1]) * 0.5,
      Math.abs(point[0] - state.dragStart[0]),
      Math.abs(point[1] - state.dragStart[1])
    );
  }

  if (state.tool === "circle") {
    const dx = point[0] - state.dragStart[0];
    const dy = point[1] - state.dragStart[1];
    ctx.beginPath();
    ctx.arc(state.dragStart[0], state.dragStart[1], Math.hypot(dx, dy), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSelection(): void {
  if (state.selectionBox) {
    ctx.strokeStyle = "#41c2ff";
    ctx.lineWidth = 1 / state.camera.scale;
    const { min, max } = state.selectionBox;
    ctx.strokeRect(min[0], min[1], max[0] - min[0], max[1] - min[1]);
  }

  const selected = new Set(engine.selected);
  for (const entity of engine.scene.entities) {
    if (!selected.has(entity.id)) {
      continue;
    }
    const geometryId = entity.components.geometry;
    if (!geometryId) {
      continue;
    }
    const geometry = engine.scene.components.geometries[geometryId];
    const bounds = geometry.localBounds ?? engine.scene.assets.meshes[geometry.mesh]?.bounds;
    if (!bounds) {
      continue;
    }
    ctx.strokeStyle = "#7dff8c";
    ctx.lineWidth = 2 / state.camera.scale;
    ctx.strokeRect(
      bounds.min[0],
      bounds.min[1],
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1]
    );
  }
}

function drawSnap(): void {
  if (!state.snapping || !state.hoverPoint) {
    return;
  }
  const snap = engine.snap(state.hoverPoint, 0.2);
  if (!snap) {
    return;
  }
  ctx.strokeStyle = "#ff7a7a";
  ctx.lineWidth = 2 / state.camera.scale;
  ctx.beginPath();
  ctx.moveTo(snap.position[0] - 0.1, snap.position[1]);
  ctx.lineTo(snap.position[0] + 0.1, snap.position[1]);
  ctx.moveTo(snap.position[0], snap.position[1] - 0.1);
  ctx.lineTo(snap.position[0], snap.position[1] + 0.1);
  ctx.stroke();
}

function readVec3(
  metadata: { properties: Record<string, unknown> },
  prefix: string
): Vector3 | null {
  const x = Number(metadata.properties[`${prefix}.x`] ?? NaN);
  const y = Number(metadata.properties[`${prefix}.y`] ?? NaN);
  const z = Number(metadata.properties[`${prefix}.z`] ?? NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return [x, y, z];
}

function updateSelectionList(): void {
  if (!selectionList) {
    return;
  }
  selectionList.innerHTML = "";
  selectionList.innerHTML = `<span>Selected</span>`;
  engine.selected.forEach((id) => {
    const row = document.createElement("span");
    row.textContent = id;
    selectionList.appendChild(row);
  });
}

init();
