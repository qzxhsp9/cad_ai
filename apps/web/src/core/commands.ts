import { CommandId, EntityId } from "./ids";
import { Vector3 } from "./components";

export type CommandType =
  | "draw_line"
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
  | ExtrudeCommand
  | TransformCommand
  | DeleteCommand
  | BatchCommand;

export interface CommandStream {
  commands: Command[];
}
