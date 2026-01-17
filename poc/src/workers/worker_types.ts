export interface GridConfig {
  x: number;
  y: number;
  z: number;
  spacing: number;
  scale: number;
}

export type WorkerRequest =
  | {
      type: "generate";
      grid: GridConfig;
      buffer?: SharedArrayBuffer;
    }
  | { type: "dispose" };

export type WorkerResponse =
  | {
      type: "generated";
      count: number;
      buffer: ArrayBuffer | SharedArrayBuffer;
      shared: boolean;
    }
  | { type: "error"; message: string };
