export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copyFrom(other: Vector3): this {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  add(other: Vector3): this {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  sub(other: Vector3): this {
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    return this;
  }

  scale(value: number): this {
    this.x *= value;
    this.y *= value;
    this.z *= value;
    return this;
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.scale(1 / len);
    }
    return this;
  }

  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
}
