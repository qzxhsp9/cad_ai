import { Mesh } from "../core/mesh";
import { Renderer } from "./renderer";

const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in vec4 inst0;
layout(location = 2) in vec4 inst1;
layout(location = 3) in vec4 inst2;
layout(location = 4) in vec4 inst3;

uniform mat4 uViewProj;

out vec3 vColor;

void main() {
  mat4 model = mat4(inst0, inst1, inst2, inst3);
  gl_Position = uViewProj * model * vec4(position, 1.0);
  vColor = vec3(0.65, 0.78, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vColor;
out vec4 outColor;

void main() {
  outColor = vec4(vColor, 1.0);
}
`;

export class WebGl2Renderer implements Renderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private instanceBuffer: WebGLBuffer | null = null;
  private uViewProjLocation: WebGLUniformLocation | null = null;
  private indexCount = 0;
  private instanceCount = 0;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) {
      throw new Error("WebGL2 not supported.");
    }

    this.gl = gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.uViewProjLocation = gl.getUniformLocation(this.program, "uViewProj");
    this.vao = gl.createVertexArray();
    this.vertexBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.instanceBuffer = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
  }

  setMesh(mesh: Mesh): void {
    if (!this.gl || !this.vao || !this.vertexBuffer || !this.indexBuffer) {
      return;
    }
    const gl = this.gl;
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    this.indexCount = mesh.indexCount;
  }

  setInstances(instanceMatrices: Float32Array): void {
    if (!this.gl || !this.vao || !this.instanceBuffer) {
      return;
    }
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceMatrices, gl.DYNAMIC_DRAW);

    const stride = 64;
    for (let i = 0; i < 4; i += 1) {
      const location = 1 + i;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, stride, i * 16);
      gl.vertexAttribDivisor(location, 1);
    }

    this.instanceCount = instanceMatrices.length / 16;
  }

  render(viewProjection: Float32Array): void {
    if (!this.gl || !this.program || !this.vao || !this.uViewProjLocation) {
      return;
    }
    const gl = this.gl;

    gl.clearColor(0.05, 0.06, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniformMatrix4fv(this.uViewProjLocation, false, viewProjection);
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      this.indexCount,
      gl.UNSIGNED_SHORT,
      0,
      this.instanceCount
    );
  }

  resize(width: number, height: number, _devicePixelRatio: number): void {
    if (!this.gl) {
      return;
    }
    this.gl.viewport(0, 0, width, height);
  }

  dispose(): void {
    if (!this.gl) {
      return;
    }
    const gl = this.gl;
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
    }
    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
    }
    if (this.indexBuffer) {
      gl.deleteBuffer(this.indexBuffer);
    }
    if (this.instanceBuffer) {
      gl.deleteBuffer(this.instanceBuffer);
    }
  }
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create WebGL program.");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown error";
    gl.deleteProgram(program);
    throw new Error(`WebGL program link error: ${info}`);
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown error";
    gl.deleteShader(shader);
    throw new Error(`WebGL shader compile error: ${info}`);
  }
  return shader;
}
