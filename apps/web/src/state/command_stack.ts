import { Command, SceneGraph } from "../core/index.js";
import { applyCommand, CommandContext, undoCommand, UndoAction } from "./command_executor.js";

export interface CommandEntry {
  command: Command;
  undo: UndoAction | null;
}

export class CommandStack {
  private scene: SceneGraph;
  private context: CommandContext;
  private undoStack: CommandEntry[] = [];
  private redoStack: CommandEntry[] = [];

  constructor(scene: SceneGraph, context: CommandContext) {
    this.scene = scene;
    this.context = context;
  }

  get current(): SceneGraph {
    return this.scene;
  }

  apply(command: Command): SceneGraph {
    const result = applyCommand(this.scene, command, this.context);
    this.scene = result.scene;
    this.undoStack.push({ command, undo: result.undo });
    this.redoStack = [];
    return this.scene;
  }

  undo(): SceneGraph {
    const entry = this.undoStack.pop();
    if (!entry) {
      return this.scene;
    }
    this.scene = undoCommand(this.scene, entry.undo, this.context);
    this.redoStack.push(entry);
    return this.scene;
  }

  redo(): SceneGraph {
    const entry = this.redoStack.pop();
    if (!entry) {
      return this.scene;
    }
    const result = applyCommand(this.scene, entry.command, this.context);
    this.scene = result.scene;
    this.undoStack.push({ command: entry.command, undo: result.undo });
    return this.scene;
  }
}
