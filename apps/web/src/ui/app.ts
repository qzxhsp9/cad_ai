type Tool = "select" | "line" | "rect" | "circle";

type Vec2 = { x: number; y: number };
type Vec3 = { x: number; y: number; z: number };

type RectProfile = { center: Vec2; width: number; height: number };
type CircleProfile = { center: Vec2; radius: number };

type Shape =
  | { id: string; type: "line"; start: Vec2; end: Vec2 }
  | { id: string; type: "rect"; center: Vec2; width: number; height: number }
  | { id: string; type: "circle"; center: Vec2; radius: number; segments: number }
  | {
      id: string;
      type: "extrude";
      profileId: string;
      height: number;
      profileType: "rect";
      profile: RectProfile;
      bounds: Bounds;
    }
  | {
      id: string;
      type: "extrude";
      profileId: string;
      height: number;
      profileType: "circle";
      profile: CircleProfile;
      bounds: Bounds;
    };

type Bounds = { min: Vec2; max: Vec2 };

type SnapType = "endpoint" | "corner" | "midpoint" | "perpendicular" | "center";

type SnapCandidate = {
  point: Vec2;
  type: SnapType;
  distance: number;
};

type View3D = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  uViewProj: WebGLUniformLocation;
  viewport: { width: number; height: number; pixelRatio: number };
  camera: {
    yaw: number;
    pitch: number;
    distance: number;
    target: Vec3;
  };
  userMoved: boolean;
  isRotating: boolean;
  isPanning: boolean;
  rotateStart: { x: number; y: number; yaw: number; pitch: number } | null;
  panStart: { x: number; y: number; target: Vec3 } | null;
};

type ImportedModel = {
  id: string;
  bounds: { min: Vec3; max: Vec3 };
  lines: Float32Array;
  meshCount: number;
};

type OcctMeshPayload = {
  id: string;
  positions: number[];
  indices?: number[];
  normals?: number[];
};

type OcctEdgePayload = {
  positions: number[];
};

type OcctModelPayload = {
  bounds: { min: [number, number, number]; max: [number, number, number] };
  meshes: OcctMeshPayload[];
  edges?: OcctEdgePayload[];
};

type OcctImportResponse = {
  modelId: string;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  meshCount: number;
};

const TOOL_LABELS: Record<Tool, string> = {
  select: "Select",
  line: "Line",
  rect: "Rectangle",
  circle: "Circle"
};

const VERTEX_SHADER_3D = `#version 300 es
precision highp float;
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 color;
uniform mat4 uViewProj;
out vec3 vColor;
void main() {
  vColor = color;
  gl_Position = uViewProj * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER_3D = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main() {
  outColor = vec4(vColor, 1.0);
}
`;

const canvas = getCanvas("#viewport");
const ctx = getCanvasContext(canvas);
const canvas3d = getCanvas("#viewport3d");
const view3d = init3dView(canvas3d);
const occtServiceUrl = getOcctServiceUrl();

const modeStatus = document.getElementById("modeStatus");
const snapStatus = document.getElementById("snapStatus");
const sceneStatus = document.getElementById("sceneStatus");
const selectionList = document.getElementById("selectionList");
const toolList = document.getElementById("toolList");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const snapToggle = document.getElementById("snapToggle");
const stepFileInput = document.getElementById("stepFile");
const stepImportBtn = document.getElementById("stepImportBtn");
const stepClearBtn = document.getElementById("stepClearBtn");
const importStatus = document.getElementById("importStatus");
const extrudeBtn = document.getElementById("extrudeBtn");
const extrudeHeightInput = document.getElementById("extrudeHeight");

const scene = {
  shapes: [] as Shape[]
};

const selection = new Set<string>();
const undoStack: Shape[][] = [];
const redoStack: Shape[][] = [];

const state = {
  tool: "select" as Tool,
  snapping: true,
  isDragging: false,
  isPanning: false,
  isRotating: false,
  dragStart: null as Vec2 | null,
  hoverPoint: null as Vec2 | null,
  snapCandidate: null as SnapCandidate | null,
  selectionBox: null as Bounds | null,
  panStart: null as { x: number; y: number; centerX: number; centerY: number } | null,
  rotateStart: null as { x: number; y: number; rotation: number } | null,
  viewport: {
    width: 0,
    height: 0,
    pixelRatio: 1
  },
  camera: {
    centerX: 0,
    centerY: 0,
    scale: 40,
    rotation: 0
  },
  statusMessage: "Ready",
  importedModel: null as ImportedModel | null,
  importMessage: "No STEP model loaded."
};

let idCounter = 0;
const ROTATE_SENSITIVITY = 0.008;
const ROTATE_STEP = Math.PI / 12;

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
  document.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas3d.addEventListener("pointerdown", onPointerDown3d);
  canvas3d.addEventListener("pointermove", onPointerMove3d);
  canvas3d.addEventListener("pointerup", onPointerUp3d);
  canvas3d.addEventListener("wheel", onWheel3d, { passive: false });
  canvas3d.addEventListener("contextmenu", (event) => event.preventDefault());

  undoBtn?.addEventListener("click", () => {
    undo();
    render();
  });
  redoBtn?.addEventListener("click", () => {
    redo();
    render();
  });
  snapToggle?.addEventListener("click", () => {
    state.snapping = !state.snapping;
    updateStatus();
    render();
  });
  stepImportBtn?.addEventListener("click", () => {
    void importStepModel();
  });
  stepClearBtn?.addEventListener("click", () => {
    state.importedModel = null;
    state.importMessage = "No STEP model loaded.";
    view3d.userMoved = false;
    render();
  });
  extrudeBtn?.addEventListener("click", () => {
    const value = Number(extrudeHeightInput instanceof HTMLInputElement ? extrudeHeightInput.value : 0);
    if (Number.isFinite(value) && value > 0) {
      extrudeSelection(value);
      render();
    }
  });
}

function getOcctServiceUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("occt") ?? "http://localhost:7071";
}

async function importStepModel(): Promise<void> {
  if (!(stepFileInput instanceof HTMLInputElement)) {
    state.importMessage = "STEP input not available.";
    updateStatus();
    return;
  }
  const file = stepFileInput.files?.[0];
  if (!file) {
    state.importMessage = "Select a STEP file first.";
    updateStatus();
    return;
  }

  state.importMessage = "Uploading STEP...";
  updateStatus();

  try {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch(`${occtServiceUrl}/api/step/import`, {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      throw new Error(`Import failed (${response.status}).`);
    }
    const payload = (await response.json()) as OcctImportResponse;
    const modelResponse = await fetch(`${occtServiceUrl}/api/step/models/${payload.modelId}`);
    if (!modelResponse.ok) {
      throw new Error(`Model fetch failed (${modelResponse.status}).`);
    }
    const modelPayload = (await modelResponse.json()) as OcctModelPayload;
    state.importedModel = buildImportedModel(payload.modelId, modelPayload);
    state.importMessage = `Imported ${file.name} | Meshes: ${payload.meshCount}`;
    view3d.userMoved = false;
    render();
  } catch (error) {
    state.importMessage = error instanceof Error ? error.message : "Import failed.";
    updateStatus();
  }
}

function buildImportedModel(modelId: string, payload: OcctModelPayload): ImportedModel {
  const lines: number[] = [];
  if (payload.edges && payload.edges.length > 0) {
    payload.edges.forEach((edge) => addPolylineEdges(lines, edge.positions));
  } else {
    payload.meshes.forEach((mesh) => addMeshEdges(lines, mesh.positions, mesh.indices));
  }
  return {
    id: modelId,
    bounds: toBounds(payload.bounds),
    lines: new Float32Array(lines),
    meshCount: payload.meshes.length
  };
}

function addPolylineEdges(lines: number[], positions: number[]): void {
  for (let i = 0; i + 5 < positions.length; i += 3) {
    lines.push(
      positions[i],
      positions[i + 1],
      positions[i + 2],
      positions[i + 3],
      positions[i + 4],
      positions[i + 5]
    );
  }
}

function addMeshEdges(lines: number[], positions: number[], indices?: number[]): void {
  if (indices && indices.length >= 3) {
    for (let i = 0; i + 2 < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      appendLine(lines, positions, i0, i1);
      appendLine(lines, positions, i1, i2);
      appendLine(lines, positions, i2, i0);
    }
    return;
  }
  for (let i = 0; i + 8 < positions.length; i += 9) {
    appendLineRaw(lines, positions, i, i + 3);
    appendLineRaw(lines, positions, i + 3, i + 6);
    appendLineRaw(lines, positions, i + 6, i);
  }
}

function appendLine(lines: number[], positions: number[], startIndex: number, endIndex: number): void {
  lines.push(
    positions[startIndex],
    positions[startIndex + 1],
    positions[startIndex + 2],
    positions[endIndex],
    positions[endIndex + 1],
    positions[endIndex + 2]
  );
}

function appendLineRaw(lines: number[], positions: number[], start: number, end: number): void {
  lines.push(
    positions[start],
    positions[start + 1],
    positions[start + 2],
    positions[end],
    positions[end + 1],
    positions[end + 2]
  );
}

function toBounds(bounds: { min: [number, number, number]; max: [number, number, number] }): {
  min: Vec3;
  max: Vec3;
} {
  return {
    min: { x: bounds.min[0], y: bounds.min[1], z: bounds.min[2] },
    max: { x: bounds.max[0], y: bounds.max[1], z: bounds.max[2] }
  };
}

function updateStatus(): void {
  if (modeStatus) {
    modeStatus.textContent = `Mode: ${TOOL_LABELS[state.tool]}`;
  }
  if (snapStatus) {
    snapStatus.textContent = `Snapping: ${state.snapping ? "On" : "Off"}`;
  }
  if (sceneStatus) {
    sceneStatus.textContent = `${state.statusMessage} | Entities: ${scene.shapes.length} | Selected: ${selection.size}`;
  }
  if (importStatus) {
    importStatus.textContent = state.importMessage;
  }
  if (undoBtn instanceof HTMLButtonElement) {
    undoBtn.disabled = undoStack.length === 0;
  }
  if (redoBtn instanceof HTMLButtonElement) {
    redoBtn.disabled = redoStack.length === 0;
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
  resizeCanvas3d();
  render();
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  const before = screenToWorld(event.offsetX, event.offsetY);
  const delta = event.deltaY < 0 ? 1.1 : 0.9;
  const nextScale = Math.max(10, Math.min(200, state.camera.scale * delta));
  state.camera.scale = nextScale;
  const after = screenToWorld(event.offsetX, event.offsetY);
  state.camera.centerX += before.x - after.x;
  state.camera.centerY += before.y - after.y;
  render();
}

function onPointerDown(event: PointerEvent): void {
  if (event.altKey) {
    state.isRotating = true;
    state.rotateStart = {
      x: event.clientX,
      y: event.clientY,
      rotation: state.camera.rotation
    };
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  if (event.button === 1 || event.button === 2 || event.shiftKey) {
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
  state.snapCandidate = state.snapping ? findSnap(point, snapTolerance()) : null;
  state.dragStart = state.snapCandidate ? state.snapCandidate.point : point;
  if (state.tool === "select") {
    state.selectionBox = null;
  }
}

function onPointerMove(event: PointerEvent): void {
  if (state.isRotating && state.rotateStart) {
    const dx = event.clientX - state.rotateStart.x;
    state.camera.rotation = state.rotateStart.rotation + dx * ROTATE_SENSITIVITY;
    render();
    return;
  }
  if (state.isPanning && state.panStart) {
    const dx = (event.clientX - state.panStart.x) / state.camera.scale;
    const dy = (event.clientY - state.panStart.y) / state.camera.scale;
    const viewDelta = { x: dx, y: -dy };
    const worldDelta = rotateVector(viewDelta, -state.camera.rotation);
    state.camera.centerX = state.panStart.centerX - worldDelta.x;
    state.camera.centerY = state.panStart.centerY - worldDelta.y;
    render();
    return;
  }
  const point = screenToWorld(event.offsetX, event.offsetY);
  state.hoverPoint = point;
  state.snapCandidate = state.snapping ? findSnap(point, snapTolerance()) : null;

  if (!state.isDragging || !state.dragStart) {
    render();
    return;
  }

  if (state.tool === "select") {
    state.selectionBox = {
      min: {
        x: Math.min(state.dragStart.x, point.x),
        y: Math.min(state.dragStart.y, point.y)
      },
      max: {
        x: Math.max(state.dragStart.x, point.x),
        y: Math.max(state.dragStart.y, point.y)
      }
    };
  }

  render();
}

function onPointerUp(event: PointerEvent): void {
  if (state.isRotating) {
    state.isRotating = false;
    state.rotateStart = null;
    canvas.releasePointerCapture(event.pointerId);
    render();
    return;
  }
  if (state.isPanning) {
    state.isPanning = false;
    state.panStart = null;
    canvas.releasePointerCapture(event.pointerId);
    render();
    return;
  }

  const point = screenToWorld(event.offsetX, event.offsetY);
  const snap = state.snapping ? findSnap(point, snapTolerance()) : null;
  const finalPoint = snap ? snap.point : point;

  if (!state.dragStart) {
    state.isDragging = false;
    return;
  }

  if (state.tool === "line") {
    addShape({
      id: nextId(),
      type: "line",
      start: state.dragStart,
      end: finalPoint
    });
  }

  if (state.tool === "rect") {
    const center = {
      x: (state.dragStart.x + finalPoint.x) * 0.5,
      y: (state.dragStart.y + finalPoint.y) * 0.5
    };
    const width = Math.abs(finalPoint.x - state.dragStart.x);
    const height = Math.abs(finalPoint.y - state.dragStart.y);
    if (width > 0.01 && height > 0.01) {
      addShape({
        id: nextId(),
        type: "rect",
        center,
        width,
        height
      });
    }
  }

  if (state.tool === "circle") {
    const dx = finalPoint.x - state.dragStart.x;
    const dy = finalPoint.y - state.dragStart.y;
    const radius = Math.max(0.05, Math.hypot(dx, dy));
    addShape({
      id: nextId(),
      type: "circle",
      center: state.dragStart,
      radius,
      segments: 48
    });
  }

  if (state.tool === "select") {
    if (state.selectionBox) {
      selectByBox(state.selectionBox);
    } else {
      selectByPoint(finalPoint);
    }
  }

  state.isDragging = false;
  state.dragStart = null;
  state.selectionBox = null;
  render();
}

function addShape(shape: Shape): void {
  pushHistory();
  scene.shapes = [...scene.shapes, shape];
  state.statusMessage = "Updated";
}

function extrudeSelection(height: number): void {
  const targetId = Array.from(selection)[0];
  if (!targetId) {
    state.statusMessage = "Select a profile to extrude.";
    return;
  }
  const target = scene.shapes.find((shape) => shape.id === targetId);
  if (!target || (target.type !== "rect" && target.type !== "circle")) {
    state.statusMessage = "Extrude supports rectangles or circles only.";
    return;
  }
  if (target.type === "rect") {
    const profile = { center: { ...target.center }, width: target.width, height: target.height };
    const bounds = getBounds(target);
    addShape({
      id: nextId(),
      type: "extrude",
      profileId: target.id,
      height,
      profileType: "rect",
      profile,
      bounds
    });
    return;
  }

  const profile = { center: { ...target.center }, radius: target.radius };
  const bounds = getBounds(target);
  addShape({
    id: nextId(),
    type: "extrude",
    profileId: target.id,
    height,
    profileType: "circle",
    profile,
    bounds
  });
}

function undo(): void {
  const previous = undoStack.pop();
  if (!previous) {
    return;
  }
  redoStack.push(cloneShapes(scene.shapes));
  scene.shapes = previous;
  selection.clear();
  state.statusMessage = "Undo";
}

function redo(): void {
  const next = redoStack.pop();
  if (!next) {
    return;
  }
  undoStack.push(cloneShapes(scene.shapes));
  scene.shapes = next;
  selection.clear();
  state.statusMessage = "Redo";
}

function pushHistory(): void {
  undoStack.push(cloneShapes(scene.shapes));
  redoStack.length = 0;
}

function cloneShapes(shapes: Shape[]): Shape[] {
  return shapes.map((shape) => {
    switch (shape.type) {
      case "line":
        return {
          ...shape,
          start: { ...shape.start },
          end: { ...shape.end }
        };
      case "rect":
        return {
          ...shape,
          center: { ...shape.center }
        };
      case "circle":
        return {
          ...shape,
          center: { ...shape.center }
        };
      case "extrude":
        return cloneExtrude(shape);
      default:
        return shape;
    }
  });
}

function cloneExtrude(shape: Extract<Shape, { type: "extrude" }>): Shape {
  const bounds = {
    min: { ...shape.bounds.min },
    max: { ...shape.bounds.max }
  };
  if (shape.profileType === "rect") {
    return {
      ...shape,
      bounds,
      profile: {
        center: { ...shape.profile.center },
        width: shape.profile.width,
        height: shape.profile.height
      }
    };
  }
  return {
    ...shape,
    bounds,
    profile: {
      center: { ...shape.profile.center },
      radius: shape.profile.radius
    }
  };
}

function selectByPoint(point: Vec2): void {
  const hit = findHit(point, snapTolerance());
  selection.clear();
  if (hit) {
    selection.add(hit.id);
  }
}

function selectByBox(box: Bounds): void {
  selection.clear();
  for (const shape of scene.shapes) {
    const bounds = getBounds(shape);
    if (boundsIntersect(bounds, box)) {
      selection.add(shape.id);
    }
  }
}

function findHit(point: Vec2, tolerance: number): Shape | null {
  for (let i = scene.shapes.length - 1; i >= 0; i -= 1) {
    const shape = scene.shapes[i];
    if (hitShape(shape, point, tolerance)) {
      return shape;
    }
  }
  return null;
}

function hitShape(shape: Shape, point: Vec2, tolerance: number): boolean {
  if (shape.type === "line") {
    return distanceToSegment(point, shape.start, shape.end) <= tolerance;
  }
  if (shape.type === "rect") {
    const bounds = getBounds(shape);
    return point.x >= bounds.min.x - tolerance && point.x <= bounds.max.x + tolerance &&
      point.y >= bounds.min.y - tolerance && point.y <= bounds.max.y + tolerance;
  }
  if (shape.type === "circle") {
    const dx = point.x - shape.center.x;
    const dy = point.y - shape.center.y;
    return Math.hypot(dx, dy) <= shape.radius + tolerance;
  }
  const bounds = getBounds(shape);
  return point.x >= bounds.min.x - tolerance && point.x <= bounds.max.x + tolerance &&
    point.y >= bounds.min.y - tolerance && point.y <= bounds.max.y + tolerance;
}

function findSnap(point: Vec2, tolerance: number): SnapCandidate | null {
  const candidates: SnapCandidate[] = [];
  const pushCandidate = (candidate: SnapCandidate) => {
    if (candidate.distance <= tolerance) {
      candidates.push(candidate);
    }
  };

  for (const shape of scene.shapes) {
    if (shape.type === "line") {
      const midpoint = midpointOf(shape.start, shape.end);
      pushCandidate({
        point: shape.start,
        type: "endpoint",
        distance: distance(point, shape.start)
      });
      pushCandidate({
        point: shape.end,
        type: "endpoint",
        distance: distance(point, shape.end)
      });
      pushCandidate({
        point: midpoint,
        type: "midpoint",
        distance: distance(point, midpoint)
      });
      const foot = footOnSegment(point, shape.start, shape.end);
      if (foot) {
        pushCandidate({
          point: foot,
          type: "perpendicular",
          distance: distance(point, foot)
        });
      }
    }

    if (shape.type === "rect") {
      const bounds = getBounds(shape);
      const corners = [
        bounds.min,
        { x: bounds.min.x, y: bounds.max.y },
        bounds.max,
        { x: bounds.max.x, y: bounds.min.y }
      ];
      for (const corner of corners) {
        pushCandidate({
          point: corner,
          type: "corner",
          distance: distance(point, corner)
        });
      }
      pushCandidate({
        point: shape.center,
        type: "center",
        distance: distance(point, shape.center)
      });
    }

    if (shape.type === "circle") {
      pushCandidate({
        point: shape.center,
        type: "center",
        distance: distance(point, shape.center)
      });
      const offsets = [
        { x: shape.radius, y: 0 },
        { x: -shape.radius, y: 0 },
        { x: 0, y: shape.radius },
        { x: 0, y: -shape.radius }
      ];
      for (const offset of offsets) {
        const candidate = {
          x: shape.center.x + offset.x,
          y: shape.center.y + offset.y
        };
        pushCandidate({
          point: candidate,
          type: "endpoint",
          distance: distance(point, candidate)
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const priority = snapPriority(a.type) - snapPriority(b.type);
    if (priority !== 0) {
      return priority;
    }
    return a.distance - b.distance;
  });

  return candidates[0];
}

function snapPriority(type: SnapType): number {
  if (type === "endpoint" || type === "corner") {
    return 0;
  }
  if (type === "perpendicular") {
    return 1;
  }
  return 2;
}

function snapTolerance(): number {
  return 6 / state.camera.scale;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpointOf(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const foot = footOnSegment(point, start, end);
  if (!foot) {
    return Math.min(distance(point, start), distance(point, end));
  }
  return distance(point, foot);
}

function footOnSegment(point: Vec2, start: Vec2, end: Vec2): Vec2 | null {
  const abx = end.x - start.x;
  const aby = end.y - start.y;
  const abLength = abx * abx + aby * aby;
  if (abLength === 0) {
    return null;
  }
  const t = ((point.x - start.x) * abx + (point.y - start.y) * aby) / abLength;
  if (t < 0 || t > 1) {
    return null;
  }
  return {
    x: start.x + abx * t,
    y: start.y + aby * t
  };
}

function getBounds(shape: Shape): Bounds {
  if (shape.type === "line") {
    return {
      min: { x: Math.min(shape.start.x, shape.end.x), y: Math.min(shape.start.y, shape.end.y) },
      max: { x: Math.max(shape.start.x, shape.end.x), y: Math.max(shape.start.y, shape.end.y) }
    };
  }
  if (shape.type === "rect") {
    return {
      min: {
        x: shape.center.x - shape.width * 0.5,
        y: shape.center.y - shape.height * 0.5
      },
      max: {
        x: shape.center.x + shape.width * 0.5,
        y: shape.center.y + shape.height * 0.5
      }
    };
  }
  if (shape.type === "circle") {
    return {
      min: { x: shape.center.x - shape.radius, y: shape.center.y - shape.radius },
      max: { x: shape.center.x + shape.radius, y: shape.center.y + shape.radius }
    };
  }
  return shape.bounds;
}

function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y
  );
}

function screenToWorld(x: number, y: number): Vec2 {
  const view = {
    x: (x - state.viewport.width * 0.5) / state.camera.scale,
    y: (state.viewport.height * 0.5 - y) / state.camera.scale
  };
  const rotated = rotateVector(view, -state.camera.rotation);
  return {
    x: rotated.x + state.camera.centerX,
    y: rotated.y + state.camera.centerY
  };
}

function render(): void {
  ctx.setTransform(state.viewport.pixelRatio, 0, 0, state.viewport.pixelRatio, 0, 0);
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  ctx.save();
  ctx.translate(state.viewport.width / 2, state.viewport.height / 2);
  ctx.scale(state.camera.scale, -state.camera.scale);
  ctx.rotate(state.camera.rotation);
  ctx.translate(-state.camera.centerX, -state.camera.centerY);

  drawGrid();
  drawScene();
  drawPreview();
  drawSelection();
  drawSnap();

  ctx.restore();
  updateSelectionList();
  updateStatus();
  render3d(view3d);
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

function onKeyDown(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  const isMod = event.ctrlKey || event.metaKey;
  if (isMod && event.code === "KeyZ") {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
    render();
    return;
  }
  if (isMod && event.code === "KeyY") {
    event.preventDefault();
    redo();
    render();
    return;
  }

  if (event.code === "KeyV") {
    setTool("select");
    return;
  }
  if (event.code === "KeyL") {
    setTool("line");
    return;
  }
  if (event.code === "KeyR") {
    setTool("rect");
    return;
  }
  if (event.code === "KeyC") {
    setTool("circle");
    return;
  }
  if (event.code === "KeyS") {
    state.snapping = !state.snapping;
    render();
    return;
  }
  if (event.code === "KeyX") {
    const value = Number(extrudeHeightInput instanceof HTMLInputElement ? extrudeHeightInput.value : 0);
    if (Number.isFinite(value) && value > 0) {
      extrudeSelection(value);
      render();
    }
    return;
  }
  if (event.code === "KeyQ") {
    state.camera.rotation -= ROTATE_STEP;
    render();
    return;
  }
  if (event.code === "KeyE") {
    state.camera.rotation += ROTATE_STEP;
    render();
    return;
  }
  if (event.code === "Digit0") {
    resetView();
    render();
    return;
  }
  if (event.code === "Escape") {
    state.isDragging = false;
    state.dragStart = null;
    state.selectionBox = null;
    setTool("select");
  }
}

function setTool(tool: Tool): void {
  state.tool = tool;
  updateStatus();
  setupTools();
  render();
}

function resetView(): void {
  state.camera.centerX = 0;
  state.camera.centerY = 0;
  state.camera.scale = 40;
  state.camera.rotation = 0;
  resetView3d(view3d);
}

function rotateVector(vec: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vec.x * cos - vec.y * sin,
    y: vec.x * sin + vec.y * cos
  };
}

function init3dView(target: HTMLCanvasElement): View3D {
  const gl = getWebGlContext(target);
  const program = createProgram(gl, VERTEX_SHADER_3D, FRAGMENT_SHADER_3D);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) {
    throw new Error("Unable to initialize WebGL buffers.");
  }
  const uViewProj = gl.getUniformLocation(program, "uViewProj");
  if (!uViewProj) {
    throw new Error("uViewProj uniform not found.");
  }

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const stride = 6 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.bindVertexArray(null);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.06, 0.07, 0.1, 1);
  gl.lineWidth(2);

  return {
    canvas: target,
    gl,
    program,
    vao,
    buffer,
    uViewProj,
    viewport: { width: 0, height: 0, pixelRatio: 1 },
    camera: {
      yaw: Math.PI / 4,
      pitch: Math.PI / 6,
      distance: 24,
      target: { x: 0, y: 0, z: 0 }
    },
    userMoved: false,
    isRotating: false,
    isPanning: false,
    rotateStart: null,
    panStart: null
  };
}

function resizeCanvas3d(): void {
  sync3dViewport(view3d);
}

function onPointerDown3d(event: PointerEvent): void {
  if (event.button === 0) {
    view3d.isRotating = true;
    view3d.rotateStart = {
      x: event.clientX,
      y: event.clientY,
      yaw: view3d.camera.yaw,
      pitch: view3d.camera.pitch
    };
  } else {
    view3d.isPanning = true;
    view3d.panStart = {
      x: event.clientX,
      y: event.clientY,
      target: { ...view3d.camera.target }
    };
  }
  view3d.userMoved = true;
  canvas3d.setPointerCapture(event.pointerId);
}

function onPointerMove3d(event: PointerEvent): void {
  if (view3d.isRotating && view3d.rotateStart) {
    const dx = event.clientX - view3d.rotateStart.x;
    const dy = event.clientY - view3d.rotateStart.y;
    view3d.camera.yaw = view3d.rotateStart.yaw + dx * 0.005;
    view3d.camera.pitch = clamp(
      view3d.rotateStart.pitch + dy * 0.005,
      -1.45,
      1.45
    );
    render();
    return;
  }
  if (view3d.isPanning && view3d.panStart) {
    const dx = event.clientX - view3d.panStart.x;
    const dy = event.clientY - view3d.panStart.y;
    const panScale = view3d.camera.distance / 300;
    const delta = { x: -dx * panScale, y: dy * panScale };
    const { right, up } = cameraBasis(view3d.camera.yaw, view3d.camera.pitch);
    view3d.camera.target = {
      x: view3d.panStart.target.x + right.x * delta.x + up.x * delta.y,
      y: view3d.panStart.target.y + right.y * delta.x + up.y * delta.y,
      z: view3d.panStart.target.z + right.z * delta.x + up.z * delta.y
    };
    render();
  }
}

function onPointerUp3d(event: PointerEvent): void {
  view3d.isRotating = false;
  view3d.isPanning = false;
  view3d.rotateStart = null;
  view3d.panStart = null;
  canvas3d.releasePointerCapture(event.pointerId);
  render();
}

function onWheel3d(event: WheelEvent): void {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 0.9 : 1.1;
  view3d.camera.distance = clamp(view3d.camera.distance * delta, 4, 200);
  view3d.userMoved = true;
  render();
}

function resetView3d(view: View3D): void {
  view.camera.yaw = Math.PI / 4;
  view.camera.pitch = Math.PI / 6;
  view.camera.distance = 24;
  view.camera.target = { x: 0, y: 0, z: 0 };
  view.userMoved = false;
}

function render3d(view: View3D): void {
  const { gl, viewport, program, vao, buffer, uViewProj } = view;
  sync3dViewport(view);
  const width = view.canvas.width;
  const height = view.canvas.height;
  if (width === 0 || height === 0) {
    return;
  }
  const bounds = computeSceneBounds3d(scene.shapes, state.importedModel);
  const sceneSize = bounds ? getBoundsSize(bounds) : 10;
  if (!view.userMoved) {
    autoFocus3d(view, sceneSize);
  }
  gl.viewport(0, 0, width, height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = viewport.width / Math.max(1, viewport.height);
  const near = Math.max(sceneSize * 0.02, 0.0001);
  const far = Math.max(sceneSize * 200, view.camera.distance * 4, 10);
  const projection = mat4Perspective((60 * Math.PI) / 180, aspect, near, far);
  const eye = orbitCameraPosition(view.camera);
  const viewMat = mat4LookAt(eye, view.camera.target, { x: 0, y: 1, z: 0 });
  const viewProj = mat4Multiply(projection, viewMat);

  const geometry = build3dGeometry(scene.shapes, selection, state.importedModel, sceneSize);
  gl.useProgram(program);
  gl.uniformMatrix4fv(uViewProj, false, viewProj);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.LINES, 0, geometry.length / 6);
  gl.bindVertexArray(null);
}

function autoFocus3d(view: View3D, sceneSize: number): void {
  const bounds = computeSceneBounds3d(scene.shapes, state.importedModel);
  if (!bounds) {
    return;
  }
  view.camera.target = {
    x: (bounds.min.x + bounds.max.x) * 0.5,
    y: (bounds.min.y + bounds.max.y) * 0.5,
    z: (bounds.min.z + bounds.max.z) * 0.5
  };
  const safeSize = Math.max(sceneSize, 0.0001);
  const baseDistance = Math.max(safeSize * 4, 2);
  view.camera.distance = clamp(baseDistance, safeSize * 0.4, 500);
}

function sync3dViewport(view: View3D): void {
  const rect = view.canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  if (rect.width === 0 || rect.height === 0) {
    return;
  }
  if (
    rect.width !== view.viewport.width ||
    rect.height !== view.viewport.height ||
    ratio !== view.viewport.pixelRatio
  ) {
    view.viewport.width = rect.width;
    view.viewport.height = rect.height;
    view.viewport.pixelRatio = ratio;
    view.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    view.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  }
}

function build3dGeometry(
  shapes: Shape[],
  selected: Set<string>,
  importedModel: ImportedModel | null,
  sceneSize: number
): Float32Array {
  const vertices: number[] = [];
  const baseColor = [0.47, 0.64, 1.0];
  const selectedColor = [0.49, 1.0, 0.55];
  const gridColor = [0.2, 0.24, 0.34];
  const importedColor = [1.0, 0.82, 0.42];
  const axisLength = Math.max(sceneSize * 2, 1);

  addGrid3d(vertices, gridColor);
  addAxis3d(vertices, axisLength);

  if (importedModel) {
    addImportedLines3d(vertices, importedModel, importedColor);
  }

  shapes.forEach((shape) => {
    const color = selected.has(shape.id) ? selectedColor : baseColor;
    if (shape.type === "line") {
      addLine3d(vertices, shape.start, shape.end, 0, color);
    }
    if (shape.type === "rect") {
      addRect3d(vertices, shape.center, shape.width, shape.height, 0, color);
    }
    if (shape.type === "circle") {
      addCircle3d(vertices, shape.center, shape.radius, 0, 48, color);
    }
    if (shape.type === "extrude") {
      if (shape.profileType === "rect") {
        addBox3d(vertices, shape.profile.center, shape.profile.width, shape.profile.height, shape.height, color);
      } else {
        addCylinder3d(vertices, shape.profile.center, shape.profile.radius, shape.height, 48, color);
      }
    }
  });

  return new Float32Array(vertices);
}

function addGrid3d(vertices: number[], color: number[]): void {
  const size = 50;
  for (let i = -size; i <= size; i += 5) {
    addSegment3d(vertices, { x: -size, y: i }, { x: size, y: i }, 0, color);
    addSegment3d(vertices, { x: i, y: -size }, { x: i, y: size }, 0, color);
  }
}

function addAxis3d(vertices: number[], length: number): void {
  addSegment3d(vertices, { x: 0, y: 0 }, { x: length, y: 0 }, 0, [1, 0.35, 0.35]);
  addSegment3d(vertices, { x: 0, y: 0 }, { x: 0, y: length }, 0, [0.35, 1, 0.35]);
  addSegment3d(vertices, { x: 0, y: 0 }, { x: 0, y: 0 }, 0, [0.35, 0.6, 1], length);
}
function addImportedLines3d(
  vertices: number[],
  model: ImportedModel,
  color: number[]
): void {
  const lines = model.lines;
  for (let i = 0; i + 5 < lines.length; i += 6) {
    vertices.push(lines[i], lines[i + 1], lines[i + 2], color[0], color[1], color[2]);
    vertices.push(lines[i + 3], lines[i + 4], lines[i + 5], color[0], color[1], color[2]);
  }
}

function addLine3d(
  vertices: number[],
  start: Vec2,
  end: Vec2,
  z: number,
  color: number[]
): void {
  addSegment3d(vertices, start, end, z, color);
}

function addRect3d(
  vertices: number[],
  center: Vec2,
  width: number,
  height: number,
  z: number,
  color: number[]
): void {
  const hx = width * 0.5;
  const hy = height * 0.5;
  const p1 = { x: center.x - hx, y: center.y - hy };
  const p2 = { x: center.x + hx, y: center.y - hy };
  const p3 = { x: center.x + hx, y: center.y + hy };
  const p4 = { x: center.x - hx, y: center.y + hy };
  addSegment3d(vertices, p1, p2, z, color);
  addSegment3d(vertices, p2, p3, z, color);
  addSegment3d(vertices, p3, p4, z, color);
  addSegment3d(vertices, p4, p1, z, color);
}

function addCircle3d(
  vertices: number[],
  center: Vec2,
  radius: number,
  z: number,
  segments: number,
  color: number[]
): void {
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = { x: center.x + Math.cos(a0) * radius, y: center.y + Math.sin(a0) * radius };
    const p1 = { x: center.x + Math.cos(a1) * radius, y: center.y + Math.sin(a1) * radius };
    addSegment3d(vertices, p0, p1, z, color);
  }
}

function addBox3d(
  vertices: number[],
  center: Vec2,
  width: number,
  height: number,
  depth: number,
  color: number[]
): void {
  const hx = width * 0.5;
  const hy = height * 0.5;
  const z0 = 0;
  const z1 = depth;
  const p1 = { x: center.x - hx, y: center.y - hy };
  const p2 = { x: center.x + hx, y: center.y - hy };
  const p3 = { x: center.x + hx, y: center.y + hy };
  const p4 = { x: center.x - hx, y: center.y + hy };
  addRect3d(vertices, center, width, height, z0, color);
  addRect3d(vertices, center, width, height, z1, color);
  addSegment3d(vertices, p1, p1, z0, color, z1);
  addSegment3d(vertices, p2, p2, z0, color, z1);
  addSegment3d(vertices, p3, p3, z0, color, z1);
  addSegment3d(vertices, p4, p4, z0, color, z1);
}

function addCylinder3d(
  vertices: number[],
  center: Vec2,
  radius: number,
  height: number,
  segments: number,
  color: number[]
): void {
  addCircle3d(vertices, center, radius, 0, segments, color);
  addCircle3d(vertices, center, radius, height, segments, color);
  for (let i = 0; i < segments; i += Math.max(1, Math.floor(segments / 8))) {
    const angle = (i / segments) * Math.PI * 2;
    const p = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    addSegment3d(vertices, p, p, 0, color, height);
  }
}

function addSegment3d(
  vertices: number[],
  start: Vec2,
  end: Vec2,
  z: number,
  color: number[],
  z2?: number
): void {
  const zEnd = z2 ?? z;
  vertices.push(start.x, start.y, z, color[0], color[1], color[2]);
  vertices.push(end.x, end.y, zEnd, color[0], color[1], color[2]);
}

function computeSceneBounds3d(
  shapes: Shape[],
  importedModel: ImportedModel | null
): { min: Vec3; max: Vec3 } | null {
  if (shapes.length === 0 && !importedModel) {
    return null;
  }
  const bounds = importedModel
    ? {
        min: { ...importedModel.bounds.min },
        max: { ...importedModel.bounds.max }
      }
    : {
        min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: 0 },
        max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: 0 }
      };
  shapes.forEach((shape) => {
    const shapeBounds = getShapeBounds3d(shape);
    bounds.min.x = Math.min(bounds.min.x, shapeBounds.min.x);
    bounds.min.y = Math.min(bounds.min.y, shapeBounds.min.y);
    bounds.min.z = Math.min(bounds.min.z, shapeBounds.min.z);
    bounds.max.x = Math.max(bounds.max.x, shapeBounds.max.x);
    bounds.max.y = Math.max(bounds.max.y, shapeBounds.max.y);
    bounds.max.z = Math.max(bounds.max.z, shapeBounds.max.z);
  });
  return bounds;
}

function getBoundsSize(bounds: { min: Vec3; max: Vec3 }): number {
  return Math.max(
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z
  );
}

function getShapeBounds3d(shape: Shape): { min: Vec3; max: Vec3 } {
  if (shape.type === "line") {
    return {
      min: {
        x: Math.min(shape.start.x, shape.end.x),
        y: Math.min(shape.start.y, shape.end.y),
        z: 0
      },
      max: {
        x: Math.max(shape.start.x, shape.end.x),
        y: Math.max(shape.start.y, shape.end.y),
        z: 0
      }
    };
  }
  if (shape.type === "rect") {
    const hx = shape.width * 0.5;
    const hy = shape.height * 0.5;
    return {
      min: { x: shape.center.x - hx, y: shape.center.y - hy, z: 0 },
      max: { x: shape.center.x + hx, y: shape.center.y + hy, z: 0 }
    };
  }
  if (shape.type === "circle") {
    return {
      min: { x: shape.center.x - shape.radius, y: shape.center.y - shape.radius, z: 0 },
      max: { x: shape.center.x + shape.radius, y: shape.center.y + shape.radius, z: 0 }
    };
  }
  return {
    min: { x: shape.bounds.min.x, y: shape.bounds.min.y, z: 0 },
    max: { x: shape.bounds.max.x, y: shape.bounds.max.y, z: shape.height }
  };
}

function orbitCameraPosition(camera: View3D["camera"]): Vec3 {
  const cosPitch = Math.cos(camera.pitch);
  return {
    x: camera.target.x + camera.distance * Math.sin(camera.yaw) * cosPitch,
    y: camera.target.y + camera.distance * Math.sin(camera.pitch),
    z: camera.target.z + camera.distance * Math.cos(camera.yaw) * cosPitch
  };
}

function cameraBasis(yaw: number, pitch: number): { right: Vec3; up: Vec3 } {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  return {
    right: { x: cosYaw, y: 0, z: -sinYaw },
    up: { x: sinYaw * sinPitch, y: cosPitch, z: cosYaw * sinPitch }
  };
}

function mat4Perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
  return out;
}

function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3): Float32Array {
  const zAxis = normalize3(subtract3(eye, target));
  const xAxis = normalize3(cross3(up, zAxis));
  const yAxis = cross3(zAxis, xAxis);
  const out = new Float32Array(16);
  out[0] = xAxis.x;
  out[1] = xAxis.y;
  out[2] = xAxis.z;
  out[3] = 0;
  out[4] = yAxis.x;
  out[5] = yAxis.y;
  out[6] = yAxis.z;
  out[7] = 0;
  out[8] = zAxis.x;
  out[9] = zAxis.y;
  out[10] = zAxis.z;
  out[11] = 0;
  out[12] = -dot3(xAxis, eye);
  out[13] = -dot3(yAxis, eye);
  out[14] = -dot3(zAxis, eye);
  out[15] = 1;
  return out;
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];
  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];
  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];
  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];

  const b00 = b[0];
  const b01 = b[1];
  const b02 = b[2];
  const b03 = b[3];
  const b10 = b[4];
  const b11 = b[5];
  const b12 = b[6];
  const b13 = b[7];
  const b20 = b[8];
  const b21 = b[9];
  const b22 = b[10];
  const b23 = b[11];
  const b30 = b[12];
  const b31 = b[13];
  const b32 = b[14];
  const b33 = b[15];

  out[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
  out[1] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
  out[2] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
  out[3] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;
  out[4] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
  out[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
  out[6] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
  out[7] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;
  out[8] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
  out[9] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
  out[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
  out[11] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;
  out[12] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;
  out[13] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;
  out[14] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;
  out[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;
  return out;
}

function normalize3(value: Vec3): Vec3 {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function subtract3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getWebGlContext(target: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = target.getContext("webgl2");
  if (!gl) {
    throw new Error("WebGL2 is required for the 3D view.");
  }
  return gl;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create WebGL program.");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown error";
    gl.deleteProgram(program);
    throw new Error(`WebGL program link failed: ${info}`);
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create WebGL shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown error";
    gl.deleteShader(shader);
    throw new Error(`WebGL shader compile failed: ${info}`);
  }
  return shader;
}

function drawScene(): void {
  for (const shape of scene.shapes) {
    ctx.strokeStyle = "#7aa2ff";
    ctx.lineWidth = 2 / state.camera.scale;

    if (shape.type === "line") {
      ctx.beginPath();
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.lineTo(shape.end.x, shape.end.y);
      ctx.stroke();
    }

    if (shape.type === "rect") {
      ctx.strokeRect(
        shape.center.x - shape.width * 0.5,
        shape.center.y - shape.height * 0.5,
        shape.width,
        shape.height
      );
    }

    if (shape.type === "circle") {
      ctx.beginPath();
      ctx.arc(shape.center.x, shape.center.y, shape.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (shape.type === "extrude") {
      const dx = shape.height * 0.2;
      const dy = shape.height * 0.2;
      if (shape.profileType === "rect") {
        const profile = shape.profile;
        ctx.strokeRect(
          profile.center.x - profile.width * 0.5,
          profile.center.y - profile.height * 0.5,
          profile.width,
          profile.height
        );
        ctx.strokeRect(
          profile.center.x - profile.width * 0.5 + dx,
          profile.center.y - profile.height * 0.5 + dy,
          profile.width,
          profile.height
        );
        ctx.beginPath();
        ctx.moveTo(profile.center.x - profile.width * 0.5, profile.center.y - profile.height * 0.5);
        ctx.lineTo(profile.center.x - profile.width * 0.5 + dx, profile.center.y - profile.height * 0.5 + dy);
        ctx.moveTo(profile.center.x + profile.width * 0.5, profile.center.y - profile.height * 0.5);
        ctx.lineTo(profile.center.x + profile.width * 0.5 + dx, profile.center.y - profile.height * 0.5 + dy);
        ctx.moveTo(profile.center.x + profile.width * 0.5, profile.center.y + profile.height * 0.5);
        ctx.lineTo(profile.center.x + profile.width * 0.5 + dx, profile.center.y + profile.height * 0.5 + dy);
        ctx.moveTo(profile.center.x - profile.width * 0.5, profile.center.y + profile.height * 0.5);
        ctx.lineTo(profile.center.x - profile.width * 0.5 + dx, profile.center.y + profile.height * 0.5 + dy);
        ctx.stroke();
      } else {
        const profile = shape.profile;
        ctx.beginPath();
        ctx.arc(profile.center.x, profile.center.y, profile.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          profile.center.x + dx,
          profile.center.y + dy,
          profile.radius,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(profile.center.x + profile.radius, profile.center.y);
        ctx.lineTo(profile.center.x + profile.radius + dx, profile.center.y + dy);
        ctx.moveTo(profile.center.x - profile.radius, profile.center.y);
        ctx.lineTo(profile.center.x - profile.radius + dx, profile.center.y + dy);
        ctx.moveTo(profile.center.x, profile.center.y + profile.radius);
        ctx.lineTo(profile.center.x + dx, profile.center.y + profile.radius + dy);
        ctx.moveTo(profile.center.x, profile.center.y - profile.radius);
        ctx.lineTo(profile.center.x + dx, profile.center.y - profile.radius + dy);
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
  const point = state.snapCandidate?.point ?? state.hoverPoint ?? state.dragStart;

  if (state.tool === "line") {
    ctx.beginPath();
    ctx.moveTo(state.dragStart.x, state.dragStart.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  if (state.tool === "rect") {
    const center = {
      x: (state.dragStart.x + point.x) * 0.5,
      y: (state.dragStart.y + point.y) * 0.5
    };
    ctx.strokeRect(
      center.x - Math.abs(point.x - state.dragStart.x) * 0.5,
      center.y - Math.abs(point.y - state.dragStart.y) * 0.5,
      Math.abs(point.x - state.dragStart.x),
      Math.abs(point.y - state.dragStart.y)
    );
  }

  if (state.tool === "circle") {
    const dx = point.x - state.dragStart.x;
    const dy = point.y - state.dragStart.y;
    ctx.beginPath();
    ctx.arc(state.dragStart.x, state.dragStart.y, Math.hypot(dx, dy), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSelection(): void {
  if (state.selectionBox) {
    ctx.strokeStyle = "#41c2ff";
    ctx.lineWidth = 1 / state.camera.scale;
    const { min, max } = state.selectionBox;
    ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
  }

  for (const shape of scene.shapes) {
    if (!selection.has(shape.id)) {
      continue;
    }
    const bounds = getBounds(shape);
    ctx.strokeStyle = "#7dff8c";
    ctx.lineWidth = 2 / state.camera.scale;
    ctx.strokeRect(
      bounds.min.x,
      bounds.min.y,
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y
    );
  }
}

function drawSnap(): void {
  if (!state.snapping || !state.snapCandidate) {
    return;
  }
  const { point } = state.snapCandidate;
  ctx.strokeStyle = "#ff7a7a";
  ctx.lineWidth = 2 / state.camera.scale;
  ctx.beginPath();
  ctx.moveTo(point.x - 0.1, point.y);
  ctx.lineTo(point.x + 0.1, point.y);
  ctx.moveTo(point.x, point.y - 0.1);
  ctx.lineTo(point.x, point.y + 0.1);
  ctx.stroke();
}

function updateSelectionList(): void {
  if (!selectionList) {
    return;
  }
  selectionList.innerHTML = "";
  selectionList.innerHTML = "<span>Selected</span>";
  for (const id of selection) {
    const shape = scene.shapes.find((entry) => entry.id === id);
    const row = document.createElement("span");
    row.textContent = shape ? `${shape.type} (${shape.id})` : id;
    selectionList.appendChild(row);
  }
}

function nextId(): string {
  idCounter += 1;
  return `shape-${idCounter}`;
}

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

init();
