export type EntityId = string;
export type ComponentId = string;
export type AssetId = string;
export type CommandId = string;

export interface IdFactory {
  nextEntityId(): EntityId;
  nextComponentId(): ComponentId;
  nextAssetId(): AssetId;
  nextCommandId(): CommandId;
}

export class IncrementingIdFactory implements IdFactory {
  private counters = { entity: 0, component: 0, asset: 0, command: 0 };
  private prefix: string;

  constructor(prefix = "id") {
    this.prefix = prefix;
  }

  nextEntityId(): EntityId {
    return this.next("entity");
  }

  nextComponentId(): ComponentId {
    return this.next("component");
  }

  nextAssetId(): AssetId {
    return this.next("asset");
  }

  nextCommandId(): CommandId {
    return this.next("command");
  }

  private next(kind: keyof typeof this.counters): string {
    this.counters[kind] += 1;
    return `${this.prefix}_${kind}_${this.counters[kind]}`;
  }
}
