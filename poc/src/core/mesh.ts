export class Mesh {
  positions: Float32Array;
  indices: Uint16Array;

  constructor(positions: Float32Array, indices: Uint16Array) {
    this.positions = positions;
    this.indices = indices;
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  get indexCount(): number {
    return this.indices.length;
  }

  static createCube(size = 1): Mesh {
    const s = size * 0.5;
    const positions = new Float32Array([
      -s, -s, -s,
      s, -s, -s,
      s, s, -s,
      -s, s, -s,
      -s, -s, s,
      s, -s, s,
      s, s, s,
      -s, s, s
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 2, 3, 0,
      4, 5, 6, 6, 7, 4,
      0, 4, 7, 7, 3, 0,
      1, 5, 6, 6, 2, 1,
      3, 2, 6, 6, 7, 3,
      0, 1, 5, 5, 4, 0
    ]);

    return new Mesh(positions, indices);
  }
}
