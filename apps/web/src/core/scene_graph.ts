import { AssetId, EntityId } from "./ids";
import {
  ComponentRefs,
  ComponentTable,
  GeometryTopology,
  Vector3
} from "./components";

export type SchemaVersion = "v0";
export type Axis = "X" | "Y" | "Z";
export type Unit = "mm" | "cm" | "m";

export interface SceneMetadata {
  name: string;
  description?: string;
  unit: Unit;
  upAxis: Axis;
  createdAt: string;
  updatedAt: string;
}

export interface EntityRecord {
  id: EntityId;
  name?: string;
  components: ComponentRefs;
}

export interface BufferLayout {
  position: { offset: number; stride: number };
  normal?: { offset: number; stride: number };
  uv?: { offset: number; stride: number };
}

export interface MeshAsset {
  id: AssetId;
  name?: string;
  vertexCount: number;
  indexCount: number;
  indexFormat: "uint16" | "uint32";
  topology: GeometryTopology;
  layout: BufferLayout;
  sourceUri?: string;
  bounds?: { min: Vector3; max: Vector3 };
}

export interface MaterialAsset {
  id: AssetId;
  name?: string;
  baseColor: [number, number, number, number];
}

export interface TextureAsset {
  id: AssetId;
  name?: string;
  uri: string;
}

export interface AssetRegistry {
  meshes: Record<AssetId, MeshAsset>;
  materials: Record<AssetId, MaterialAsset>;
  textures: Record<AssetId, TextureAsset>;
}

export interface SceneGraph {
  schemaVersion: SchemaVersion;
  metadata: SceneMetadata;
  entities: EntityRecord[];
  components: ComponentTable;
  assets: AssetRegistry;
}
