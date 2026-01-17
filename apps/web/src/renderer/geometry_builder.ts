import {
  AssetId,
  GeometryTopology,
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
      const endpoints = findLineEndpoints(scene, meshId);
      meshes[meshId] = buildLineMesh(endpoints, mesh.indexFormat);
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

function findLineEndpoints(
  scene: SceneGraph,
  meshId: AssetId
): { start: Vector3; end: Vector3 } {
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

  throw new Error(`No line endpoints found for mesh ${meshId}`);
}
