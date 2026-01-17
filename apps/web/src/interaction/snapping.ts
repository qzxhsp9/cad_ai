import { SceneGraph, Vector3 } from "../core/index.js";

export type SnapType = "endpoint" | "midpoint" | "perpendicular" | "center" | "corner";

export interface SnapResult {
  type: SnapType;
  position: Vector3;
  entityId: string;
  distance: number;
}

export function computeSnap(
  scene: SceneGraph,
  cursor: Vector3,
  tolerance: number
): SnapResult | null {
  const candidates: SnapResult[] = [];

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
    if (primitive === "line") {
      const start = readVec3(metadata, "line.start");
      const end = readVec3(metadata, "line.end");
      if (!start || !end) {
        continue;
      }
      pushCandidate(candidates, entity.id, "endpoint", start, cursor);
      pushCandidate(candidates, entity.id, "endpoint", end, cursor);
      const midpoint: Vector3 = [
        (start[0] + end[0]) * 0.5,
        (start[1] + end[1]) * 0.5,
        (start[2] + end[2]) * 0.5
      ];
      pushCandidate(candidates, entity.id, "midpoint", midpoint, cursor);
      const foot = projectPointOnSegment(cursor, start, end);
      if (foot) {
        pushCandidate(candidates, entity.id, "perpendicular", foot, cursor);
      }
    }

    if (primitive === "rect") {
      const center = readVec3(metadata, "rect.center");
      const width = Number(metadata.properties["rect.width"] ?? 0);
      const height = Number(metadata.properties["rect.height"] ?? 0);
      if (!center || width <= 0 || height <= 0) {
        continue;
      }
      const halfW = width * 0.5;
      const halfH = height * 0.5;
      const corners: Vector3[] = [
        [center[0] - halfW, center[1] - halfH, center[2]],
        [center[0] + halfW, center[1] - halfH, center[2]],
        [center[0] + halfW, center[1] + halfH, center[2]],
        [center[0] - halfW, center[1] + halfH, center[2]]
      ];
      for (const corner of corners) {
        pushCandidate(candidates, entity.id, "corner", corner, cursor);
      }
      pushCandidate(candidates, entity.id, "center", center, cursor);
    }

    if (primitive === "circle") {
      const center = readVec3(metadata, "circle.center");
      const radius = Number(metadata.properties["circle.radius"] ?? 0);
      if (!center || radius <= 0) {
        continue;
      }
      pushCandidate(candidates, entity.id, "center", center, cursor);
      const cardinal: Vector3[] = [
        [center[0] + radius, center[1], center[2]],
        [center[0] - radius, center[1], center[2]],
        [center[0], center[1] + radius, center[2]],
        [center[0], center[1] - radius, center[2]]
      ];
      for (const point of cardinal) {
        pushCandidate(candidates, entity.id, "endpoint", point, cursor);
      }
    }
  }

  const nearest = candidates
    .filter((candidate) => candidate.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest ?? null;
}

function pushCandidate(
  list: SnapResult[],
  entityId: string,
  type: SnapType,
  position: Vector3,
  cursor: Vector3
): void {
  list.push({
    type,
    position,
    entityId,
    distance: distance2D(position, cursor)
  });
}

function distance2D(a: Vector3, b: Vector3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function readVec3(metadata: { properties: Record<string, unknown> }, prefix: string): Vector3 | null {
  const x = Number(metadata.properties[`${prefix}.x`] ?? NaN);
  const y = Number(metadata.properties[`${prefix}.y`] ?? NaN);
  const z = Number(metadata.properties[`${prefix}.z`] ?? NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return [x, y, z];
}

function projectPointOnSegment(
  point: Vector3,
  start: Vector3,
  end: Vector3
): Vector3 | null {
  const vx = end[0] - start[0];
  const vy = end[1] - start[1];
  const lengthSq = vx * vx + vy * vy;
  if (lengthSq === 0) {
    return null;
  }
  const t = ((point[0] - start[0]) * vx + (point[1] - start[1]) * vy) / lengthSq;
  if (t < 0 || t > 1) {
    return null;
  }
  return [start[0] + vx * t, start[1] + vy * t, start[2]];
}
