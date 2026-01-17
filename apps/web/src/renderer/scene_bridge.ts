import {
  AssetId,
  SceneGraph,
  TransformComponent,
  Vector3
} from "../core/index.js";
import { buildGeometryBuffers, MeshBuffers } from "./geometry_builder.js";

export interface RenderBatch {
  meshId: AssetId;
  mesh: MeshBuffers;
  instances: Float32Array;
}

export interface RendererBridge {
  setMesh(mesh: MeshBuffers): void;
  setInstances(instances: Float32Array): void;
}

export function buildRenderBatches(scene: SceneGraph): RenderBatch[] {
  const buffers = buildGeometryBuffers(scene);
  const grouped = new Map<AssetId, TransformComponent[]>();

  for (const entity of scene.entities) {
    const geometryId = entity.components.geometry;
    if (!geometryId) {
      continue;
    }
    const geometry = scene.components.geometries[geometryId];
    if (!geometry) {
      continue;
    }
    const transform = entity.components.transform
      ? scene.components.transforms[entity.components.transform]
      : undefined;
    const transforms = grouped.get(geometry.mesh) ?? [];
    transforms.push(transform ?? defaultTransform());
    grouped.set(geometry.mesh, transforms);
  }

  const batches: RenderBatch[] = [];
  for (const [meshId, transforms] of grouped.entries()) {
    const mesh = buffers.meshes[meshId];
    if (!mesh) {
      continue;
    }
    batches.push({
      meshId,
      mesh,
      instances: buildInstanceMatrices(transforms)
    });
  }

  return batches;
}

export function renderScene(
  scene: SceneGraph,
  renderer: RendererBridge
): RenderBatch[] {
  const batches = buildRenderBatches(scene);
  for (const batch of batches) {
    renderer.setMesh(batch.mesh);
    renderer.setInstances(batch.instances);
  }
  return batches;
}

function buildInstanceMatrices(transforms: TransformComponent[]): Float32Array {
  const matrices = new Float32Array(transforms.length * 16);
  for (let i = 0; i < transforms.length; i += 1) {
    const matrix = composeMatrix(transforms[i]);
    matrices.set(matrix, i * 16);
  }
  return matrices;
}

function composeMatrix(transform: TransformComponent): Float32Array {
  const [sx, sy, sz] = transform.scale;
  const [rx, ry, rz] = transform.rotation;
  const [tx, ty, tz] = transform.position;

  const sxr = Math.sin(rx);
  const cxr = Math.cos(rx);
  const syr = Math.sin(ry);
  const cyr = Math.cos(ry);
  const szr = Math.sin(rz);
  const czr = Math.cos(rz);

  const m11 = cyr * czr;
  const m12 = cyr * szr;
  const m13 = -syr;
  const m21 = sxr * syr * czr - cxr * szr;
  const m22 = sxr * syr * szr + cxr * czr;
  const m23 = sxr * cyr;
  const m31 = cxr * syr * czr + sxr * szr;
  const m32 = cxr * syr * szr - sxr * czr;
  const m33 = cxr * cyr;

  return new Float32Array([
    m11 * sx,
    m12 * sx,
    m13 * sx,
    0,
    m21 * sy,
    m22 * sy,
    m23 * sy,
    0,
    m31 * sz,
    m32 * sz,
    m33 * sz,
    0,
    tx,
    ty,
    tz,
    1
  ]);
}

function defaultTransform(): TransformComponent {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
}
