import { AssetId, GeometryTopology } from "../core/index.js";
import { GeometryBufferMap, MeshBuffers } from "../renderer/geometry_builder.js";

export type IndexFormat = "uint16" | "uint32";

export interface SerializedMeshBuffers {
  positions: ArrayBuffer;
  indices: ArrayBuffer;
  indexFormat: IndexFormat;
  topology: GeometryTopology;
}

export interface SerializedGeometryBufferMap {
  meshes: Record<AssetId, SerializedMeshBuffers>;
}

export interface GeometryWorkerRequest {
  type: "build";
  scene: unknown;
}

export interface GeometryWorkerResponse {
  type: "built";
  buffers: SerializedGeometryBufferMap;
}

export interface GeometryWorkerError {
  type: "error";
  message: string;
}

export type GeometryWorkerMessage = GeometryWorkerResponse | GeometryWorkerError;

export function serializeGeometryBuffers(
  buffers: GeometryBufferMap
): SerializedGeometryBufferMap {
  const meshes: Record<AssetId, SerializedMeshBuffers> = {};

  for (const [meshId, mesh] of Object.entries(buffers.meshes)) {
    const positions = copyBuffer(mesh.positions);
    const indices = copyBuffer(mesh.indices);
    meshes[meshId] = {
      positions,
      indices,
      indexFormat: mesh.indices instanceof Uint32Array ? "uint32" : "uint16",
      topology: mesh.topology
    };
  }

  return { meshes };
}

export function deserializeGeometryBuffers(
  payload: SerializedGeometryBufferMap
): GeometryBufferMap {
  const meshes: Record<AssetId, MeshBuffers> = {};

  for (const [meshId, mesh] of Object.entries(payload.meshes)) {
    const positions = new Float32Array(mesh.positions);
    const indices =
      mesh.indexFormat === "uint32"
        ? new Uint32Array(mesh.indices)
        : new Uint16Array(mesh.indices);
    meshes[meshId] = {
      positions,
      indices,
      topology: mesh.topology
    };
  }

  return { meshes };
}

export function collectTransferables(
  payload: SerializedGeometryBufferMap
): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  for (const mesh of Object.values(payload.meshes)) {
    buffers.push(mesh.positions, mesh.indices);
  }
  return buffers;
}

function copyBuffer(data: ArrayBufferView): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = data;
  if (byteOffset === 0 && byteLength === buffer.byteLength) {
    return buffer.slice(0);
  }
  return buffer.slice(byteOffset, byteOffset + byteLength);
}
