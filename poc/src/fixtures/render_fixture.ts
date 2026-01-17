import { OrbitCamera } from "../core/camera";

export interface GridConfig {
  x: number;
  y: number;
  z: number;
  spacing: number;
  scale: number;
}

export interface CameraFraming {
  yaw?: number;
  pitch?: number;
  distanceMultiplier?: number;
}

export interface RegressionFixture {
  name: string;
  camera: CameraFraming;
}

export function getRegressionFixture(
  params: URLSearchParams
): RegressionFixture | null {
  const fixture = params.get("fixture");
  if (fixture === "baseline") {
    return {
      name: "baseline",
      camera: {
        yaw: Math.PI * 0.25,
        pitch: Math.PI * 0.2,
        distanceMultiplier: 2.4
      }
    };
  }
  return null;
}

export function frameCameraToGrid(
  camera: OrbitCamera,
  grid: GridConfig,
  framing: CameraFraming = {}
): void {
  const halfX = (grid.x - 1) * grid.spacing * 0.5;
  const halfY = (grid.y - 1) * grid.spacing * 0.5;
  const halfZ = (grid.z - 1) * grid.spacing * 0.5;
  const radius = Math.hypot(halfX, halfY, halfZ) + grid.spacing;
  const multiplier = framing.distanceMultiplier ?? 2.4;
  const distance = Math.max(camera.distance, radius * multiplier);

  camera.distance = distance;
  camera.maxDistance = Math.max(camera.maxDistance, distance * 2);
  camera.near = Math.max(0.05, radius / 100);
  camera.far = Math.max(camera.far, radius * 10);

  if (typeof framing.yaw === "number") {
    camera.yaw = framing.yaw;
  }
  if (typeof framing.pitch === "number") {
    camera.pitch = framing.pitch;
  }
}
