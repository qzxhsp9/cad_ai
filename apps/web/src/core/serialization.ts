import { createEmptyComponentTable } from "./components.js";
import { SceneGraph, SceneMetadata, SchemaVersion } from "./scene_graph.js";

export const SCHEMA_VERSION: SchemaVersion = "v0";

export function createEmptySceneGraph(
  overrides: Partial<SceneMetadata> = {}
): SceneGraph {
  const now = new Date().toISOString();
  const metadata: SceneMetadata = {
    name: "Untitled",
    unit: "mm",
    upAxis: "Y",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    metadata,
    entities: [],
    components: createEmptyComponentTable(),
    assets: {
      meshes: {},
      materials: {},
      textures: {}
    }
  };
}
