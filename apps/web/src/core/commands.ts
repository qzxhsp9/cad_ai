import { CommandId, EntityId } from "./ids.js";
import { Vector3 } from "./components.js";

export type CommandType =
  | "draw_line"
  | "draw_rect"
  | "draw_circle"
  | "extrude"
  | "transform"
  | "delete"
  | "batch";

export interface BaseCommand {
  id: CommandId;
  type: CommandType;
  createdAt: string;
  author?: string;
}

export interface DrawLineCommand extends BaseCommand {
  type: "draw_line";
  start: Vector3;
  end: Vector3;
  layerId?: string;
}

export interface DrawRectCommand extends BaseCommand {
  type: "draw_rect";
  center: Vector3;
  width: number;
  height: number;
  layerId?: string;
}

export interface DrawCircleCommand extends BaseCommand {
  type: "draw_circle";
  center: Vector3;
  radius: number;
  segments?: number;
  layerId?: string;
}

export interface ExtrudeCommand extends BaseCommand {
  type: "extrude";
  profileEntityId: EntityId;
  height: number;
}

export interface TransformCommand extends BaseCommand {
  type: "transform";
  entityIds: EntityId[];
  matrix: number[];
}

export interface DeleteCommand extends BaseCommand {
  type: "delete";
  entityIds: EntityId[];
}

export interface BatchCommand extends BaseCommand {
  type: "batch";
  commands: Command[];
}

export type Command =
  | DrawLineCommand
  | DrawRectCommand
  | DrawCircleCommand
  | ExtrudeCommand
  | TransformCommand
  | DeleteCommand
  | BatchCommand;

export interface CommandStream {
  commands: Command[];
}
