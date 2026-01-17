import {
  AssetId,
  Command,
  ComponentId,
  ComponentRefs,
  EntityId,
  GeometryComponent,
  IdFactory,
  MaterialComponent,
  MetadataComponent,
  SceneGraph,
  TransformComponent,
  Vector3
} from "../core/index.js";

export interface CommandContext {
  idFactory: IdFactory;
  now?: () => string;
}

type TransformUndoEntry = {
  entityId: EntityId;
  transformId: ComponentId;
  previous: TransformComponent;
};

export type UndoAction =
  | {
      type: "delete_created";
      entityId: EntityId;
      componentIds: ComponentRefs;
      meshIds: AssetId[];
    }
  | {
      type: "restore_transforms";
      entries: TransformUndoEntry[];
    }
  | {
      type: "restore_deleted";
      entities: SceneGraph["entities"];
      components: SceneGraph["components"];
      assets: SceneGraph["assets"];
    };

export interface CommandResult {
  scene: SceneGraph;
  undo: UndoAction | null;
}

const DEFAULT_MATERIAL: MaterialComponent = {
  baseColor: [0.65, 0.78, 1.0, 1.0],
  metallic: 0,
  roughness: 0.4,
  opacity: 1
};

const DEFAULT_TRANSFORM: TransformComponent = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1]
};

export function applyCommand(
  scene: SceneGraph,
  command: Command,
  context: CommandContext
): CommandResult {
  if (command.type === "draw_line") {
    return applyDrawLine(scene, command, context);
  }

  if (command.type === "transform") {
    return applyTransform(scene, command, context);
  }

  if (command.type === "delete") {
    return applyDelete(scene, command, context);
  }

  throw new Error(`Unsupported command: ${command.type}`);
}

export function undoCommand(
  scene: SceneGraph,
  undo: UndoAction | null,
  context: CommandContext
): SceneGraph {
  if (!undo) {
    return scene;
  }
  if (undo.type === "delete_created") {
    const nextScene = cloneSceneGraph(scene);
    removeEntity(nextScene, undo.entityId, undo.componentIds);
    removeAssets(nextScene, undo.meshIds);
    nextScene.metadata.updatedAt = now(context);
    return nextScene;
  }
  if (undo.type === "restore_transforms") {
    const nextScene = cloneSceneGraph(scene);
    for (const entry of undo.entries) {
      nextScene.components.transforms[entry.transformId] = cloneTransform(
        entry.previous
      );
    }
    nextScene.metadata.updatedAt = now(context);
    return nextScene;
  }
  if (undo.type === "restore_deleted") {
    const nextScene = cloneSceneGraph(scene);
    nextScene.entities = [...nextScene.entities, ...undo.entities];
    nextScene.components = mergeComponents(nextScene.components, undo.components);
    nextScene.assets = mergeAssets(nextScene.assets, undo.assets);
    nextScene.metadata.updatedAt = now(context);
    return nextScene;
  }
  return scene;
}

function applyDrawLine(
  scene: SceneGraph,
  command: Extract<Command, { type: "draw_line" }>,
  context: CommandContext
): CommandResult {
  assertVector(command.start, "start");
  assertVector(command.end, "end");

  const nextScene = cloneSceneGraph(scene);
  const idFactory = context.idFactory;
  const entityId = idFactory.nextEntityId();
  const transformId = idFactory.nextComponentId();
  const geometryId = idFactory.nextComponentId();
  const materialId = idFactory.nextComponentId();
  const metadataId = idFactory.nextComponentId();
  const meshId = idFactory.nextAssetId();

  const bounds = computeBounds(command.start, command.end);

  const geometry: GeometryComponent = {
    mesh: meshId,
    topology: "lines",
    localBounds: bounds
  };

  const metadata: MetadataComponent = {
    tags: ["primitive:line"],
    properties: {
      primitive: "line",
      "line.start.x": command.start[0],
      "line.start.y": command.start[1],
      "line.start.z": command.start[2],
      "line.end.x": command.end[0],
      "line.end.y": command.end[1],
      "line.end.z": command.end[2]
    }
  };

  nextScene.components.transforms[transformId] = cloneTransform(DEFAULT_TRANSFORM);
  nextScene.components.geometries[geometryId] = geometry;
  nextScene.components.materials[materialId] = cloneMaterial(DEFAULT_MATERIAL);
  nextScene.components.metadata[metadataId] = metadata;

  nextScene.entities.push({
    id: entityId,
    name: "Line",
    components: {
      transform: transformId,
      geometry: geometryId,
      material: materialId,
      metadata: metadataId
    }
  });

  nextScene.assets.meshes[meshId] = {
    id: meshId,
    name: "Line",
    vertexCount: 2,
    indexCount: 2,
    indexFormat: "uint16",
    topology: "lines",
    layout: {
      position: { offset: 0, stride: 12 }
    },
    sourceUri: "primitive:line",
    bounds
  };

  nextScene.metadata.updatedAt = now(context);

  return {
    scene: nextScene,
    undo: {
      type: "delete_created",
      entityId,
      componentIds: {
        transform: transformId,
        geometry: geometryId,
        material: materialId,
        metadata: metadataId
      },
      meshIds: [meshId]
    }
  };
}

function applyTransform(
  scene: SceneGraph,
  command: Extract<Command, { type: "transform" }>,
  context: CommandContext
): CommandResult {
  const nextScene = cloneSceneGraph(scene);
  const entries: TransformUndoEntry[] = [];

  const translation = extractTranslation(command.matrix);
  if (!translation) {
    return { scene, undo: null };
  }

  for (const entityId of command.entityIds) {
    const entity = nextScene.entities.find((record) => record.id === entityId);
    if (!entity?.components.transform) {
      continue;
    }
    const transformId = entity.components.transform;
    const current = nextScene.components.transforms[transformId];
    if (!current) {
      continue;
    }
    entries.push({
      entityId,
      transformId,
      previous: cloneTransform(current)
    });

    nextScene.components.transforms[transformId] = {
      ...current,
      position: [...translation]
    };
  }

  if (entries.length === 0) {
    return { scene, undo: null };
  }

  nextScene.metadata.updatedAt = now(context);

  return {
    scene: nextScene,
    undo: {
      type: "restore_transforms",
      entries
    }
  };
}

function applyDelete(
  scene: SceneGraph,
  command: Extract<Command, { type: "delete" }>,
  context: CommandContext
): CommandResult {
  const nextScene = cloneSceneGraph(scene);
  const snapshot = snapshotDeletion(nextScene, command.entityIds);

  if (snapshot.entities.length === 0) {
    return { scene, undo: null };
  }

  for (const entity of snapshot.entities) {
    const componentIds = entity.components;
    removeEntity(nextScene, entity.id, componentIds);
  }
  removeAssets(nextScene, snapshot.removedMeshIds);

  nextScene.metadata.updatedAt = now(context);

  return {
    scene: nextScene,
    undo: {
      type: "restore_deleted",
      entities: snapshot.entities,
      components: snapshot.components,
      assets: snapshot.assets
    }
  };
}

function assertVector(value: Vector3, label: string): void {
  if (value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`Invalid ${label} vector.`);
  }
}

function cloneSceneGraph(scene: SceneGraph): SceneGraph {
  return {
    ...scene,
    metadata: { ...scene.metadata },
    entities: scene.entities.map((entity) => ({
      ...entity,
      components: { ...entity.components }
    })),
    components: {
      transforms: { ...scene.components.transforms },
      geometries: { ...scene.components.geometries },
      materials: { ...scene.components.materials },
      layers: { ...scene.components.layers },
      metadata: { ...scene.components.metadata }
    },
    assets: {
      meshes: { ...scene.assets.meshes },
      materials: { ...scene.assets.materials },
      textures: { ...scene.assets.textures }
    }
  };
}

function cloneTransform(transform: TransformComponent): TransformComponent {
  return {
    position: [...transform.position],
    rotation: [...transform.rotation],
    scale: [...transform.scale]
  };
}

function cloneMaterial(material: MaterialComponent): MaterialComponent {
  return {
    baseColor: [...material.baseColor],
    metallic: material.metallic,
    roughness: material.roughness,
    opacity: material.opacity
  };
}

function computeBounds(start: Vector3, end: Vector3) {
  return {
    min: [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.min(start[2], end[2])] as Vector3,
    max: [Math.max(start[0], end[0]), Math.max(start[1], end[1]), Math.max(start[2], end[2])] as Vector3
  };
}

function removeEntity(
  scene: SceneGraph,
  entityId: EntityId,
  componentIds: ComponentRefs
): void {
  scene.entities = scene.entities.filter((entity) => entity.id !== entityId);
  if (componentIds.transform) {
    delete scene.components.transforms[componentIds.transform];
  }
  if (componentIds.geometry) {
    delete scene.components.geometries[componentIds.geometry];
  }
  if (componentIds.material) {
    delete scene.components.materials[componentIds.material];
  }
  if (componentIds.metadata) {
    delete scene.components.metadata[componentIds.metadata];
  }
}

function extractTranslation(matrix: number[]): Vector3 | null {
  if (!Array.isArray(matrix) || matrix.length < 16) {
    return null;
  }
  return [matrix[12], matrix[13], matrix[14]];
}

function snapshotDeletion(scene: SceneGraph, entityIds: EntityId[]) {
  const entities = scene.entities.filter((entity) => entityIds.includes(entity.id));
  const components = {
    transforms: {} as SceneGraph["components"]["transforms"],
    geometries: {} as SceneGraph["components"]["geometries"],
    materials: {} as SceneGraph["components"]["materials"],
    layers: {} as SceneGraph["components"]["layers"],
    metadata: {} as SceneGraph["components"]["metadata"]
  };
  const assets = {
    meshes: {} as SceneGraph["assets"]["meshes"],
    materials: {} as SceneGraph["assets"]["materials"],
    textures: {} as SceneGraph["assets"]["textures"]
  };
  const meshIds = new Set<AssetId>();
  const deletedGeometryIds = new Set<ComponentId>();

  for (const entity of entities) {
    const refs = entity.components;
    if (refs.transform && scene.components.transforms[refs.transform]) {
      components.transforms[refs.transform] = cloneTransform(
        scene.components.transforms[refs.transform]
      );
    }
    if (refs.geometry && scene.components.geometries[refs.geometry]) {
      const geometry = scene.components.geometries[refs.geometry];
      components.geometries[refs.geometry] = geometry;
      deletedGeometryIds.add(refs.geometry);
      meshIds.add(geometry.mesh);
    }
    if (refs.material && scene.components.materials[refs.material]) {
      components.materials[refs.material] = cloneMaterial(
        scene.components.materials[refs.material]
      );
    }
    if (refs.layer && scene.components.layers[refs.layer]) {
      components.layers[refs.layer] = scene.components.layers[refs.layer];
    }
    if (refs.metadata && scene.components.metadata[refs.metadata]) {
      components.metadata[refs.metadata] = scene.components.metadata[refs.metadata];
    }
  }

  const remainingMeshes = new Set(
    Object.entries(scene.components.geometries)
      .filter(([geometryId]) => !deletedGeometryIds.has(geometryId))
      .map(([, geometry]) => geometry.mesh)
  );

  for (const meshId of meshIds) {
    if (!remainingMeshes.has(meshId)) {
      assets.meshes[meshId] = scene.assets.meshes[meshId];
    }
  }

  const removedMeshIds = Array.from(meshIds).filter(
    (meshId) => !remainingMeshes.has(meshId)
  );

  return {
    entities,
    components,
    assets,
    meshIds: Array.from(meshIds),
    removedMeshIds
  };
}

function removeAssets(scene: SceneGraph, meshIds: AssetId[]): void {
  for (const meshId of meshIds) {
    delete scene.assets.meshes[meshId];
  }
}

function mergeComponents(
  target: SceneGraph["components"],
  source: SceneGraph["components"]
): SceneGraph["components"] {
  return {
    transforms: { ...target.transforms, ...source.transforms },
    geometries: { ...target.geometries, ...source.geometries },
    materials: { ...target.materials, ...source.materials },
    layers: { ...target.layers, ...source.layers },
    metadata: { ...target.metadata, ...source.metadata }
  };
}

function mergeAssets(
  target: SceneGraph["assets"],
  source: SceneGraph["assets"]
): SceneGraph["assets"] {
  return {
    meshes: { ...target.meshes, ...source.meshes },
    materials: { ...target.materials, ...source.materials },
    textures: { ...target.textures, ...source.textures }
  };
}

function now(context: CommandContext): string {
  return context.now ? context.now() : new Date().toISOString();
}
