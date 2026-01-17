import { SceneGraph, Vector3 } from "../core/index.js";

export interface Aabb {
  min: Vector3;
  max: Vector3;
}

export interface BvhItem {
  entityId: string;
  bounds: Aabb;
}

export interface BvhNode {
  bounds: Aabb;
  left?: BvhNode;
  right?: BvhNode;
  items?: BvhItem[];
}

export function buildBvh(items: BvhItem[]): BvhNode | null {
  if (items.length === 0) {
    return null;
  }
  const bounds = mergeBounds(items.map((item) => item.bounds));
  if (items.length <= 2) {
    return { bounds, items };
  }

  const axis = longestAxis(bounds);
  const sorted = [...items].sort(
    (a, b) => centerOf(a.bounds)[axis] - centerOf(b.bounds)[axis]
  );
  const mid = Math.floor(sorted.length / 2);
  const left = buildBvh(sorted.slice(0, mid));
  const right = buildBvh(sorted.slice(mid));

  return { bounds, left: left ?? undefined, right: right ?? undefined };
}

export function queryPoint(node: BvhNode | null, point: Vector3): string[] {
  if (!node) {
    return [];
  }
  if (!containsPoint(node.bounds, point)) {
    return [];
  }
  if (node.items) {
    return node.items
      .filter((item) => containsPoint(item.bounds, point))
      .map((item) => item.entityId);
  }
  return [
    ...queryPoint(node.left ?? null, point),
    ...queryPoint(node.right ?? null, point)
  ];
}

export function queryBox(node: BvhNode | null, bounds: Aabb): string[] {
  if (!node) {
    return [];
  }
  if (!intersects(node.bounds, bounds)) {
    return [];
  }
  if (node.items) {
    return node.items
      .filter((item) => intersects(item.bounds, bounds))
      .map((item) => item.entityId);
  }
  return [
    ...queryBox(node.left ?? null, bounds),
    ...queryBox(node.right ?? null, bounds)
  ];
}

export function buildEntityBounds(scene: SceneGraph): BvhItem[] {
  const items: BvhItem[] = [];
  for (const entity of scene.entities) {
    const geometryId = entity.components.geometry;
    if (!geometryId) {
      continue;
    }
    const geometry = scene.components.geometries[geometryId];
    if (!geometry) {
      continue;
    }
    const bounds = geometry.localBounds ?? scene.assets.meshes[geometry.mesh]?.bounds;
    if (!bounds) {
      continue;
    }
    items.push({
      entityId: entity.id,
      bounds
    });
  }
  return items;
}

function mergeBounds(bounds: Aabb[]): Aabb {
  const min: Vector3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vector3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const box of bounds) {
    min[0] = Math.min(min[0], box.min[0]);
    min[1] = Math.min(min[1], box.min[1]);
    min[2] = Math.min(min[2], box.min[2]);
    max[0] = Math.max(max[0], box.max[0]);
    max[1] = Math.max(max[1], box.max[1]);
    max[2] = Math.max(max[2], box.max[2]);
  }
  return { min, max };
}

function centerOf(bounds: Aabb): Vector3 {
  return [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5
  ];
}

function longestAxis(bounds: Aabb): 0 | 1 | 2 {
  const extents: Vector3 = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2]
  ];
  if (extents[0] >= extents[1] && extents[0] >= extents[2]) {
    return 0;
  }
  if (extents[1] >= extents[2]) {
    return 1;
  }
  return 2;
}

function containsPoint(bounds: Aabb, point: Vector3): boolean {
  return (
    point[0] >= bounds.min[0] &&
    point[0] <= bounds.max[0] &&
    point[1] >= bounds.min[1] &&
    point[1] <= bounds.max[1] &&
    point[2] >= bounds.min[2] &&
    point[2] <= bounds.max[2]
  );
}

function intersects(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] &&
    a.max[2] >= b.min[2]
  );
}
