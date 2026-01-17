import { EntityRecord } from "../core/index.js";

export interface PickingColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PickingMap {
  idToEntity: Record<number, string>;
  entityToColor: Record<string, PickingColor>;
}

export function encodeIdToColor(id: number): PickingColor {
  const clamped = Math.max(0, Math.min(id, 0xffffff));
  const r = (clamped & 0xff) / 255;
  const g = ((clamped >> 8) & 0xff) / 255;
  const b = ((clamped >> 16) & 0xff) / 255;
  return { r, g, b, a: 1 };
}

export function decodeColorToId(color: PickingColor): number {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return r | (g << 8) | (b << 16);
}

export function createPickingMap(entities: EntityRecord[]): PickingMap {
  const idToEntity: Record<number, string> = {};
  const entityToColor: Record<string, PickingColor> = {};

  entities.forEach((entity, index) => {
    const id = index + 1;
    const color = encodeIdToColor(id);
    idToEntity[id] = entity.id;
    entityToColor[entity.id] = color;
  });

  return { idToEntity, entityToColor };
}
