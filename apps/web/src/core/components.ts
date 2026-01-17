import { AssetId, ComponentId } from "./ids.js";

export type Vector3 = [number, number, number];
export type Vector4 = [number, number, number, number];

export interface Aabb {
  min: Vector3;
  max: Vector3;
}

export interface TransformComponent {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export type GeometryTopology = "triangles" | "lines";

export interface GeometryComponent {
  mesh: AssetId;
  topology: GeometryTopology;
  localBounds?: Aabb;
}

export interface MaterialComponent {
  baseColor: Vector4;
  metallic: number;
  roughness: number;
  opacity: number;
}

export interface LayerComponent {
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface MetadataComponent {
  tags: string[];
  properties: Record<string, string | number | boolean | null>;
}

export interface ComponentRefs {
  transform?: ComponentId;
  geometry?: ComponentId;
  material?: ComponentId;
  layer?: ComponentId;
  metadata?: ComponentId;
}

export interface ComponentTable {
  transforms: Record<ComponentId, TransformComponent>;
  geometries: Record<ComponentId, GeometryComponent>;
  materials: Record<ComponentId, MaterialComponent>;
  layers: Record<ComponentId, LayerComponent>;
  metadata: Record<ComponentId, MetadataComponent>;
}

export function createEmptyComponentTable(): ComponentTable {
  return {
    transforms: {},
    geometries: {},
    materials: {},
    layers: {},
    metadata: {}
  };
}
