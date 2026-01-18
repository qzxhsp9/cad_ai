type Tool = "select" | "line" | "rect" | "circle";

type Vec2 = { x: number; y: number };

type Shape =
  | { id: string; type: "line"; start: Vec2; end: Vec2 }
  | { id: string; type: "rect"; center: Vec2; width: number; height: number }
  | { id: string; type: "circle"; center: Vec2; radius: number; segments: number }
  | { id: string; type: "extrude"; profileId: string; height: number; bounds: Bounds };

type Bounds = { min: Vec2; max: Vec2 };

type SnapType = "endpoint" | "corner" | "midpoint" | "perpendicular" | "center";

type SnapCandidate = {
  point: Vec2;
  type: SnapType;
  distance: number;
};

const TOOL_LABELS: Record<Tool, string> = {
  select: "Select",
  line: "Line",
  rect: "Rectangle",
  circle: "Circle"
};

const canvas = getCanvas("#viewport");
const ctx = getCanvasContext(canvas);

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
  dragStart: null as Vec2 | null,
  hoverPoint: null as Vec2 | null,
  snapCandidate: null as SnapCandidate | null,
  selectionBox: null as Bounds | null,
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
  },
  statusMessage: "Ready"
};

let idCounter = 0;

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
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

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
  extrudeBtn?.addEventListener("click", () => {
    const value = Number(extrudeHeightInput instanceof HTMLInputElement ? extrudeHeightInput.value : 0);
    if (Number.isFinite(value) && value > 0) {
      extrudeSelection(value);
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
  if (sceneStatus) {
    sceneStatus.textContent = `${state.statusMessage} | Entities: ${scene.shapes.length} | Selected: ${selection.size}`;
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
  const bounds = getBounds(target);
  addShape({
    id: nextId(),
    type: "extrude",
    profileId: target.id,
    height,
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
    if (shape.type === "line") {
      return {
        ...shape,
        start: { ...shape.start },
        end: { ...shape.end }
      };
    }
    if (shape.type === "rect") {
      return {
        ...shape,
        center: { ...shape.center }
      };
    }
    if (shape.type === "circle") {
      return {
        ...shape,
        center: { ...shape.center }
      };
    }
    return {
      ...shape,
      bounds: {
        min: { ...shape.bounds.min },
        max: { ...shape.bounds.max }
      }
    };
  });
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
  return {
    x: (x - state.viewport.width * 0.5) / state.camera.scale + state.camera.centerX,
    y: (state.viewport.height * 0.5 - y) / state.camera.scale + state.camera.centerY
  };
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
      const bounds = shape.bounds;
      ctx.strokeRect(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
      ctx.strokeRect(
        bounds.min.x + dx,
        bounds.min.y + dy,
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y
      );
      ctx.beginPath();
      ctx.moveTo(bounds.min.x, bounds.min.y);
      ctx.lineTo(bounds.min.x + dx, bounds.min.y + dy);
      ctx.moveTo(bounds.max.x, bounds.min.y);
      ctx.lineTo(bounds.max.x + dx, bounds.min.y + dy);
      ctx.moveTo(bounds.max.x, bounds.max.y);
      ctx.lineTo(bounds.max.x + dx, bounds.max.y + dy);
      ctx.moveTo(bounds.min.x, bounds.max.y);
      ctx.lineTo(bounds.min.x + dx, bounds.max.y + dy);
      ctx.stroke();
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
