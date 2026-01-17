import {
  AssetId,
  Command,
  CommandId,
  ComponentRefs,
  EntityId,
  GeometryComponent,
  GeometryTopology,
  IdFactory,
  MaterialComponent,
  MetadataComponent,
  SceneGraph,
  TransformComponent,
  Vector3
} from "../core";

export interface CommandContext {
  idFactory: IdFactory;
  now?: () => string;
}

export type UndoAction =
  | {
      type: "delete_created";
      entityId: EntityId;
      componentIds: ComponentRefs;
      meshIds: AssetId[];
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
    removeEntity(nextScene, undo.entityId, undo.componentIds, undo.meshIds);
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
    topology: GeometryTopology.Lines,
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
  componentIds: ComponentRefs,
  meshIds: AssetId[]
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

  for (const meshId of meshIds) {
    delete scene.assets.meshes[meshId];
  }
}

function now(context: CommandContext): string {
  return context.now ? context.now() : new Date().toISOString();
}
