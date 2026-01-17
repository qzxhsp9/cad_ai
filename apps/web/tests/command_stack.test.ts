import * as assert from "node:assert/strict";
import { test } from "node:test";

import { Command, createEmptySceneGraph, IncrementingIdFactory } from "../src/core/index.js";
import { CommandStack } from "../src/state/index.js";

test("command stack apply/undo/redo", () => {
  const idFactory = new IncrementingIdFactory("test");
  const scene = createEmptySceneGraph({ name: "Stack Test" });
  const stack = new CommandStack(scene, { idFactory });

  const command: Command = {
    id: idFactory.nextCommandId(),
    type: "draw_line",
    createdAt: "2026-01-18T00:00:00Z",
    start: [0, 0, 0],
    end: [1, 0, 0]
  };

  const afterApply = stack.apply(command);
  assert.equal(afterApply.entities.length, 1);

  const afterUndo = stack.undo();
  assert.equal(afterUndo.entities.length, 0);

  const afterRedo = stack.redo();
  assert.equal(afterRedo.entities.length, 1);
});
