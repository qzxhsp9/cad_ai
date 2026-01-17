import * as assert from "node:assert/strict";
import { test } from "node:test";

import { createPickingMap, decodeColorToId, encodeIdToColor } from "../src/renderer/gpu_picking.js";

test("encode/decode picking id", () => {
  const color = encodeIdToColor(4242);
  const id = decodeColorToId(color);
  assert.equal(id, 4242);
});

test("createPickingMap assigns unique colors", () => {
  const entities = [
    { id: "e1", components: {} },
    { id: "e2", components: {} }
  ];

  const map = createPickingMap(entities);
  assert.equal(Object.keys(map.entityToColor).length, 2);
  assert.equal(Object.keys(map.idToEntity).length, 2);
});
