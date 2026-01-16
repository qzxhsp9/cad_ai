import { Mesh } from "../core/mesh";

export interface Renderer {
  initialize(canvas: HTMLCanvasElement): Promise<void>;
  setMesh(mesh: Mesh): void;
  setInstances(instanceMatrices: Float32Array): void;
  render(viewProjection: Float32Array): void;
  resize(width: number, height: number, devicePixelRatio: number): void;
  dispose(): void;
}
