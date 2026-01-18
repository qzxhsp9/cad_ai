import {
  Command,
  EntityId,
  SceneGraph,
  Vector3
} from "../core/index.js";
import { CommandContext, CommandStack } from "../state/index.js";
import { buildEntityBounds, buildBvh, queryBox, queryPoint } from "../selection/bvh.js";
import { computeSnap, SnapResult } from "./snapping.js";
import {
  createPickingMap,
  decodeColorToId,
  PickingColor
} from "../renderer/gpu_picking.js";

export interface SelectionBox {
  min: Vector3;
  max: Vector3;
}

export class InteractionEngine {
  private stack: CommandStack;
  private bvh: ReturnType<typeof buildBvh> = null;
  private bvhDirty = true;
  private selection = new Set<EntityId>();

  constructor(scene: SceneGraph, context: CommandContext) {
    this.stack = new CommandStack(scene, context);
  }

  get scene(): SceneGraph {
    return this.stack.current;
  }

  get selected(): EntityId[] {
    return Array.from(this.selection);
  }

  apply(command: Command): SceneGraph {
    const next = this.stack.apply(command);
    this.bvhDirty = true;
    return next;
  }

  undo(): SceneGraph {
    const next = this.stack.undo();
    this.bvhDirty = true;
    return next;
  }

  redo(): SceneGraph {
    const next = this.stack.redo();
    this.bvhDirty = true;
    return next;
  }

  snap(cursor: Vector3, tolerance: number): SnapResult | null {
    return computeSnap(this.scene, cursor, tolerance);
  }

  selectPoint(point: Vector3): EntityId[] {
    const ids = queryPoint(this.ensureBvh(), point);
    this.selection = new Set(ids);
    return ids;
  }

  selectBox(box: SelectionBox): EntityId[] {
    const ids = queryBox(this.ensureBvh(), box);
    this.selection = new Set(ids);
    return ids;
  }

  clearSelection(): void {
    this.selection.clear();
  }

  resolvePickingColor(color: PickingColor): EntityId | null {
    const map = createPickingMap(this.scene.entities);
    const id = decodeColorToId(color);
    return map.idToEntity[id] ?? null;
  }

  extrudeSelection(height: number): SceneGraph {
    const target = this.selected[0];
    if (!target) {
      throw new Error("No selection to extrude.");
    }
    const context = this.stack.commandContext;
    return this.apply({
      id: context.idFactory.nextCommandId(),
      type: "extrude",
      createdAt: new Date().toISOString(),
      profileEntityId: target,
      height
    });
  }

  private ensureBvh() {
    if (this.bvhDirty) {
      this.bvh = buildBvh(buildEntityBounds(this.scene));
      this.bvhDirty = false;
    }
    return this.bvh;
  }
}
