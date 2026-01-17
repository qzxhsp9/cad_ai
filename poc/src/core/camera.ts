import { Matrix4 } from "./matrix4.js";
import { Vector3 } from "./vector3.js";

const WORLD_UP = new Vector3(0, 1, 0);

export class OrbitCamera {
  target: Vector3;
  distance: number;
  yaw: number;
  pitch: number;
  minDistance: number;
  maxDistance: number;
  fovY: number;
  near: number;
  far: number;

  constructor() {
    this.target = new Vector3(0, 0, 0);
    this.distance = 20;
    this.yaw = Math.PI * 0.25;
    this.pitch = Math.PI * 0.2;
    this.minDistance = 2;
    this.maxDistance = 200;
    this.fovY = Math.PI / 4;
    this.near = 0.1;
    this.far = 1000;
  }

  orbit(deltaYaw: number, deltaPitch: number): void {
    this.yaw += deltaYaw;
    this.pitch += deltaPitch;
    const limit = Math.PI * 0.49;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  pan(deltaX: number, deltaY: number): void {
    const position = this.getPosition();
    const viewDir = this.target.clone().sub(position).normalize();
    const right = viewDir.clone().cross(WORLD_UP).normalize();
    const up = right.clone().cross(viewDir).normalize();

    const panScale = this.distance * 0.002;
    const moveRight = right.scale(-deltaX * panScale);
    const moveUp = up.scale(deltaY * panScale);

    this.target.add(moveRight).add(moveUp);
  }

  zoom(delta: number): void {
    this.distance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.distance * (1 + delta))
    );
  }

  getPosition(out = new Vector3()): Vector3 {
    const cosPitch = Math.cos(this.pitch);
    out.x = this.target.x + this.distance * Math.sin(this.yaw) * cosPitch;
    out.y = this.target.y + this.distance * Math.sin(this.pitch);
    out.z = this.target.z + this.distance * Math.cos(this.yaw) * cosPitch;
    return out;
  }

  getViewMatrix(out = new Matrix4()): Matrix4 {
    const position = this.getPosition();
    return Matrix4.lookAt(position, this.target, WORLD_UP, out);
  }

  getProjectionMatrix(
    aspect: number,
    out = new Matrix4(),
    depthZeroToOne = false
  ): Matrix4 {
    return Matrix4.perspective(
      this.fovY,
      aspect,
      this.near,
      this.far,
      out,
      depthZeroToOne
    );
  }
}
