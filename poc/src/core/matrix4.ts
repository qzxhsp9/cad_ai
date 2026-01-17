import { Vector3 } from "./vector3.js";

export class Matrix4 {
  elements: Float32Array;

  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }

  identity(): this {
    const e = this.elements;
    e[0] = 1;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;
    e[4] = 0;
    e[5] = 1;
    e[6] = 0;
    e[7] = 0;
    e[8] = 0;
    e[9] = 0;
    e[10] = 1;
    e[11] = 0;
    e[12] = 0;
    e[13] = 0;
    e[14] = 0;
    e[15] = 1;
    return this;
  }

  copyFrom(other: Matrix4): this {
    this.elements.set(other.elements);
    return this;
  }

  clone(): Matrix4 {
    const copy = new Matrix4();
    copy.elements.set(this.elements);
    return copy;
  }

  multiply(other: Matrix4): Matrix4 {
    return Matrix4.multiply(this, other, this);
  }

  static multiply(a: Matrix4, b: Matrix4, out = new Matrix4()): Matrix4 {
    const ae = a.elements;
    const be = b.elements;
    const oe = out.elements;

    const a00 = ae[0];
    const a01 = ae[1];
    const a02 = ae[2];
    const a03 = ae[3];
    const a10 = ae[4];
    const a11 = ae[5];
    const a12 = ae[6];
    const a13 = ae[7];
    const a20 = ae[8];
    const a21 = ae[9];
    const a22 = ae[10];
    const a23 = ae[11];
    const a30 = ae[12];
    const a31 = ae[13];
    const a32 = ae[14];
    const a33 = ae[15];

    const b00 = be[0];
    const b01 = be[1];
    const b02 = be[2];
    const b03 = be[3];
    const b10 = be[4];
    const b11 = be[5];
    const b12 = be[6];
    const b13 = be[7];
    const b20 = be[8];
    const b21 = be[9];
    const b22 = be[10];
    const b23 = be[11];
    const b30 = be[12];
    const b31 = be[13];
    const b32 = be[14];
    const b33 = be[15];

    oe[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
    oe[1] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
    oe[2] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
    oe[3] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;
    oe[4] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
    oe[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
    oe[6] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
    oe[7] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;
    oe[8] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
    oe[9] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
    oe[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
    oe[11] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;
    oe[12] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;
    oe[13] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;
    oe[14] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;
    oe[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;

    return out;
  }

  static perspective(
    fovYRadians: number,
    aspect: number,
    near: number,
    far: number,
    out = new Matrix4(),
    depthZeroToOne = false
  ): Matrix4 {
    const f = 1 / Math.tan(fovYRadians / 2);
    const e = out.elements;

    e[0] = f / aspect;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;
    e[4] = 0;
    e[5] = f;
    e[6] = 0;
    e[7] = 0;
    e[8] = 0;
    e[9] = 0;
    if (depthZeroToOne) {
      const nf = 1 / (near - far);
      e[10] = far * nf;
      e[11] = -1;
      e[12] = 0;
      e[13] = 0;
      e[14] = far * near * nf;
      e[15] = 0;
      return out;
    }

    const nf = 1 / (near - far);
    e[10] = (far + near) * nf;
    e[11] = -1;
    e[12] = 0;
    e[13] = 0;
    e[14] = 2 * far * near * nf;
    e[15] = 0;

    return out;
  }

  static lookAt(
    eye: Vector3,
    target: Vector3,
    up: Vector3,
    out = new Matrix4()
  ): Matrix4 {
    const zAxis = eye.clone().sub(target).normalize();
    const xAxis = up.clone().cross(zAxis).normalize();
    const yAxis = zAxis.clone().cross(xAxis).normalize();

    const e = out.elements;
    e[0] = xAxis.x;
    e[1] = yAxis.x;
    e[2] = zAxis.x;
    e[3] = 0;
    e[4] = xAxis.y;
    e[5] = yAxis.y;
    e[6] = zAxis.y;
    e[7] = 0;
    e[8] = xAxis.z;
    e[9] = yAxis.z;
    e[10] = zAxis.z;
    e[11] = 0;
    e[12] = -xAxis.dot(eye);
    e[13] = -yAxis.dot(eye);
    e[14] = -zAxis.dot(eye);
    e[15] = 1;
    return out;
  }

  static compose(
    position: Vector3,
    rotation: Vector3,
    scale: Vector3,
    out = new Matrix4()
  ): Matrix4 {
    const sx = Math.sin(rotation.x);
    const cx = Math.cos(rotation.x);
    const sy = Math.sin(rotation.y);
    const cy = Math.cos(rotation.y);
    const sz = Math.sin(rotation.z);
    const cz = Math.cos(rotation.z);

    const m11 = cy * cz;
    const m12 = cy * sz;
    const m13 = -sy;
    const m21 = sx * sy * cz - cx * sz;
    const m22 = sx * sy * sz + cx * cz;
    const m23 = sx * cy;
    const m31 = cx * sy * cz + sx * sz;
    const m32 = cx * sy * sz - sx * cz;
    const m33 = cx * cy;

    const e = out.elements;
    e[0] = m11 * scale.x;
    e[1] = m21 * scale.x;
    e[2] = m31 * scale.x;
    e[3] = 0;
    e[4] = m12 * scale.y;
    e[5] = m22 * scale.y;
    e[6] = m32 * scale.y;
    e[7] = 0;
    e[8] = m13 * scale.z;
    e[9] = m23 * scale.z;
    e[10] = m33 * scale.z;
    e[11] = 0;
    e[12] = position.x;
    e[13] = position.y;
    e[14] = position.z;
    e[15] = 1;

    return out;
  }
}
