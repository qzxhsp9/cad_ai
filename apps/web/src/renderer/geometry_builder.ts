import {
  AssetId,
  GeometryTopology,
  MetadataComponent,
  SceneGraph,
  Vector3
} from "../core/index.js";

export interface MeshBuffers {
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  topology: GeometryTopology;
}

export interface GeometryBufferMap {
  meshes: Record<AssetId, MeshBuffers>;
}

export function buildGeometryBuffers(scene: SceneGraph): GeometryBufferMap {
  const meshes: Record<AssetId, MeshBuffers> = {};

  for (const [meshId, mesh] of Object.entries(scene.assets.meshes)) {
    if (!mesh.sourceUri) {
      continue;
    }
    if (mesh.sourceUri.startsWith("primitive:cube")) {
      meshes[meshId] = buildCubeMesh(mesh.indexFormat);
      continue;
    }
    if (mesh.sourceUri.startsWith("primitive:line")) {
      const metadata = findMetadata(scene, meshId);
      const endpoints = findLineEndpoints(metadata);
      meshes[meshId] = buildLineMesh(endpoints, mesh.indexFormat);
      continue;
    }
    if (mesh.sourceUri.startsWith("primitive:rect")) {
      const metadata = findMetadata(scene, meshId);
      const rect = buildRectDefinition(mesh.bounds, metadata);
      meshes[meshId] = buildRectMesh(
        rect.center,
        rect.width,
        rect.height,
        mesh.indexFormat
      );
      continue;
    }
    if (mesh.sourceUri.startsWith("primitive:circle")) {
      const metadata = findMetadata(scene, meshId);
      const circle = buildCircleDefinition(mesh.bounds, metadata);
      meshes[meshId] = buildCircleMesh(
        circle.center,
        circle.radius,
        circle.segments,
        mesh.indexFormat
      );
      continue;
    }
    if (mesh.sourceUri.startsWith("primitive:extrude")) {
      const metadata = findMetadata(scene, meshId);
      const extrude = buildExtrudeDefinition(metadata);
      meshes[meshId] = buildExtrudeMesh(
        extrude.profilePoints,
        extrude.height,
        mesh.indexFormat
      );
    }
  }

  return { meshes };
}

function buildCubeMesh(indexFormat: "uint16" | "uint32"): MeshBuffers {
  const positions = new Float32Array([
    -0.5, -0.5, -0.5,
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5
  ]);
  const indices = indexFormat === "uint32"
    ? new Uint32Array([
        0, 1, 2, 2, 3, 0,
        4, 5, 6, 6, 7, 4,
        0, 4, 7, 7, 3, 0,
        1, 5, 6, 6, 2, 1,
        3, 2, 6, 6, 7, 3,
        0, 1, 5, 5, 4, 0
      ])
    : new Uint16Array([
        0, 1, 2, 2, 3, 0,
        4, 5, 6, 6, 7, 4,
        0, 4, 7, 7, 3, 0,
        1, 5, 6, 6, 2, 1,
        3, 2, 6, 6, 7, 3,
        0, 1, 5, 5, 4, 0
      ]);

  return {
    positions,
    indices,
    topology: "triangles"
  };
}

function buildLineMesh(
  endpoints: { start: Vector3; end: Vector3 },
  indexFormat: "uint16" | "uint32"
): MeshBuffers {
  const positions = new Float32Array([
    endpoints.start[0],
    endpoints.start[1],
    endpoints.start[2],
    endpoints.end[0],
    endpoints.end[1],
    endpoints.end[2]
  ]);
  const indices = indexFormat === "uint32"
    ? new Uint32Array([0, 1])
    : new Uint16Array([0, 1]);

  return {
    positions,
    indices,
    topology: "lines"
  };
}

function findMetadata(scene: SceneGraph, meshId: AssetId): MetadataComponent | null {
  for (const entity of scene.entities) {
    const geometryId = entity.components.geometry;
    const metadataId = entity.components.metadata;
    if (!geometryId || !metadataId) {
      continue;
    }
    const geometry = scene.components.geometries[geometryId];
    if (!geometry || geometry.mesh !== meshId) {
      continue;
    }
    const metadata = scene.components.metadata[metadataId];
    if (!metadata) {
      continue;
    }
    return metadata;
  }

  return null;
}

function findLineEndpoints(metadata: MetadataComponent | null): {
  start: Vector3;
  end: Vector3;
} {
  if (!metadata) {
    throw new Error("Line metadata not found.");
  }
  const start: Vector3 = [
    Number(metadata.properties["line.start.x"] ?? 0),
    Number(metadata.properties["line.start.y"] ?? 0),
    Number(metadata.properties["line.start.z"] ?? 0)
  ];
  const end: Vector3 = [
    Number(metadata.properties["line.end.x"] ?? 0),
    Number(metadata.properties["line.end.y"] ?? 0),
    Number(metadata.properties["line.end.z"] ?? 0)
  ];
  return { start, end };
}

function buildRectDefinition(
  bounds: { min: Vector3; max: Vector3 } | undefined,
  metadata: MetadataComponent | null
): { center: Vector3; width: number; height: number } {
  if (metadata) {
    const center: Vector3 = [
      Number(metadata.properties["rect.center.x"] ?? 0),
      Number(metadata.properties["rect.center.y"] ?? 0),
      Number(metadata.properties["rect.center.z"] ?? 0)
    ];
    const width = Number(metadata.properties["rect.width"] ?? 0);
    const height = Number(metadata.properties["rect.height"] ?? 0);
    if (width > 0 && height > 0) {
      return { center, width, height };
    }
  }
  if (!bounds) {
    throw new Error("Rect bounds not found.");
  }
  const center: Vector3 = [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5
  ];
  return {
    center,
    width: bounds.max[0] - bounds.min[0],
    height: bounds.max[1] - bounds.min[1]
  };
}

function buildCircleDefinition(
  bounds: { min: Vector3; max: Vector3 } | undefined,
  metadata: MetadataComponent | null
): { center: Vector3; radius: number; segments: number } {
  if (metadata) {
    const center: Vector3 = [
      Number(metadata.properties["circle.center.x"] ?? 0),
      Number(metadata.properties["circle.center.y"] ?? 0),
      Number(metadata.properties["circle.center.z"] ?? 0)
    ];
    const radius = Number(metadata.properties["circle.radius"] ?? 0);
    const segments = Math.max(3, Number(metadata.properties["circle.segments"] ?? 32));
    if (radius > 0) {
      return { center, radius, segments };
    }
  }
  if (!bounds) {
    throw new Error("Circle bounds not found.");
  }
  const radius = (bounds.max[0] - bounds.min[0]) * 0.5;
  const center: Vector3 = [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    bounds.min[2]
  ];
  return { center, radius, segments: 32 };
}

function buildExtrudeDefinition(
  metadata: MetadataComponent | null
): { profilePoints: Vector3[]; height: number } {
  if (!metadata) {
    throw new Error("Extrude metadata not found.");
  }
  const height = Number(metadata.properties["extrude.height"] ?? 0);
  const profile = String(metadata.properties["extrude.profile"] ?? "");
  if (profile === "rect") {
    const min: Vector3 = [
      Number(metadata.properties["profile.min.x"] ?? 0),
      Number(metadata.properties["profile.min.y"] ?? 0),
      Number(metadata.properties["profile.min.z"] ?? 0)
    ];
    const max: Vector3 = [
      Number(metadata.properties["profile.max.x"] ?? 0),
      Number(metadata.properties["profile.max.y"] ?? 0),
      Number(metadata.properties["profile.max.z"] ?? 0)
    ];
    const center: Vector3 = [
      (min[0] + max[0]) * 0.5,
      (min[1] + max[1]) * 0.5,
      (min[2] + max[2]) * 0.5
    ];
    return {
      profilePoints: rectPoints(center, max[0] - min[0], max[1] - min[1]),
      height
    };
  }
  if (profile === "circle") {
    const radius = Number(metadata.properties["circle.radius"] ?? 1);
    const center: Vector3 = [
      Number(metadata.properties["circle.center.x"] ?? 0),
      Number(metadata.properties["circle.center.y"] ?? 0),
      Number(metadata.properties["circle.center.z"] ?? 0)
    ];
    const segments = Math.max(3, Number(metadata.properties["extrude.segments"] ?? 32));
    return {
      profilePoints: circlePoints(center, radius, segments),
      height
    };
  }

  throw new Error("Unsupported extrude profile.");
}

function buildRectMesh(
  center: Vector3,
  width: number,
  height: number,
  indexFormat: "uint16" | "uint32"
): MeshBuffers {
  const points = rectPoints(center, width, height);
  const positions = new Float32Array(points.flat());
  const indices = buildLineIndices(points.length, indexFormat);
  return {
    positions,
    indices,
    topology: "lines"
  };
}

function buildCircleMesh(
  center: Vector3,
  radius: number,
  segments: number,
  indexFormat: "uint16" | "uint32"
): MeshBuffers {
  const points = circlePoints(center, radius, segments);
  const positions = new Float32Array(points.flat());
  const indices = buildLineIndices(points.length, indexFormat);
  return {
    positions,
    indices,
    topology: "lines"
  };
}

function buildExtrudeMesh(
  profile: Vector3[],
  height: number,
  indexFormat: "uint16" | "uint32"
): MeshBuffers {
  const positions = new Float32Array(profile.length * 2 * 3);
  profile.forEach((point, index) => {
    const baseOffset = index * 3;
    positions[baseOffset] = point[0];
    positions[baseOffset + 1] = point[1];
    positions[baseOffset + 2] = point[2];
    const topOffset = (profile.length + index) * 3;
    positions[topOffset] = point[0];
    positions[topOffset + 1] = point[1];
    positions[topOffset + 2] = point[2] + height;
  });

  const indices = buildExtrudeIndices(profile.length, indexFormat);
  return {
    positions,
    indices,
    topology: "triangles"
  };
}

function rectPoints(center: Vector3, width: number, height: number): Vector3[] {
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  return [
    [center[0] - halfW, center[1] - halfH, center[2]],
    [center[0] + halfW, center[1] - halfH, center[2]],
    [center[0] + halfW, center[1] + halfH, center[2]],
    [center[0] - halfW, center[1] + halfH, center[2]]
  ];
}

function circlePoints(center: Vector3, radius: number, segments: number): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push([
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
      center[2]
    ]);
  }
  return points;
}

function buildLineIndices(
  pointCount: number,
  indexFormat: "uint16" | "uint32"
): Uint16Array | Uint32Array {
  const indices = new Array<number>();
  for (let i = 0; i < pointCount; i += 1) {
    indices.push(i, (i + 1) % pointCount);
  }
  return indexFormat === "uint32"
    ? new Uint32Array(indices)
    : new Uint16Array(indices);
}

function buildExtrudeIndices(
  pointCount: number,
  indexFormat: "uint16" | "uint32"
): Uint16Array | Uint32Array {
  const indices: number[] = [];
  const topOffset = pointCount;

  for (let i = 0; i < pointCount; i += 1) {
    const next = (i + 1) % pointCount;
    indices.push(i, next, topOffset + next);
    indices.push(topOffset + next, topOffset + i, i);
  }

  for (let i = 1; i < pointCount - 1; i += 1) {
    indices.push(0, i, i + 1);
    indices.push(topOffset, topOffset + i + 1, topOffset + i);
  }

  return indexFormat === "uint32"
    ? new Uint32Array(indices)
    : new Uint16Array(indices);
}
