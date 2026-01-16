import { Mesh } from "../core/mesh";
import { Renderer } from "./renderer";

const SHADER = `
struct Uniforms {
  viewProj: mat4x4<f32>;
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3<f32>;
  @location(1) inst0: vec4<f32>;
  @location(2) inst1: vec4<f32>;
  @location(3) inst2: vec4<f32>;
  @location(4) inst3: vec4<f32>;
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>;
  @location(0) color: vec3<f32>;
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let model = mat4x4<f32>(input.inst0, input.inst1, input.inst2, input.inst3);
  let world = model * vec4<f32>(input.position, 1.0);

  var output: VertexOutput;
  output.position = uniforms.viewProj * world;
  output.color = vec3<f32>(0.65, 0.78, 1.0);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color, 1.0);
}
`;

export class WebGpuRenderer implements Renderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private instanceBuffer: GPUBuffer | null = null;
  private depthTexture: GPUTexture | null = null;
  private indexCount = 0;
  private instanceCount = 0;
  private size = { width: 0, height: 0 };

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported.");
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance"
    });
    if (!adapter) {
      throw new Error("No WebGPU adapter found.");
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("Unable to acquire WebGPU context.");
    }

    this.device = device;
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.configureContext();

    this.uniformBuffer = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" }
        }
      ]
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        }
      ]
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });

    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: device.createShaderModule({ code: SHADER }),
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }]
          },
          {
            arrayStride: 64,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 1, format: "float32x4", offset: 0 },
              { shaderLocation: 2, format: "float32x4", offset: 16 },
              { shaderLocation: 3, format: "float32x4", offset: 32 },
              { shaderLocation: 4, format: "float32x4", offset: 48 }
            ]
          }
        ]
      },
      fragment: {
        module: device.createShaderModule({ code: SHADER }),
        entryPoint: "fs_main",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back"
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less"
      }
    });
  }

  setMesh(mesh: Mesh): void {
    if (!this.device) {
      return;
    }
    const device = this.device;
    this.vertexBuffer = device.createBuffer({
      size: mesh.positions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.writeBuffer(this.vertexBuffer, mesh.positions);

    this.indexBuffer = device.createBuffer({
      size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this.writeBuffer(this.indexBuffer, mesh.indices);

    this.indexCount = mesh.indexCount;
  }

  setInstances(instanceMatrices: Float32Array): void {
    if (!this.device) {
      return;
    }
    const device = this.device;
    this.instanceBuffer = device.createBuffer({
      size: instanceMatrices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.writeBuffer(this.instanceBuffer, instanceMatrices);
    this.instanceCount = instanceMatrices.length / 16;
  }

  render(viewProjection: Float32Array): void {
    if (
      !this.device ||
      !this.context ||
      !this.pipeline ||
      !this.uniformBuffer ||
      !this.bindGroup ||
      !this.vertexBuffer ||
      !this.indexBuffer ||
      !this.instanceBuffer
    ) {
      return;
    }

    this.writeBuffer(this.uniformBuffer, viewProjection);

    const encoder = this.device.createCommandEncoder();
    const colorAttachment: GPURenderPassColorAttachment = {
      view: this.context.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0.05, g: 0.06, b: 0.08, a: 1.0 }
    };

    const pass = encoder.beginRenderPass({
      colorAttachments: [colorAttachment],
      depthStencilAttachment: this.depthTexture
        ? {
            view: this.depthTexture.createView(),
            depthLoadOp: "clear",
            depthStoreOp: "store",
            depthClearValue: 1.0
          }
        : undefined
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setVertexBuffer(1, this.instanceBuffer);
    pass.setIndexBuffer(this.indexBuffer, "uint16");
    pass.drawIndexed(this.indexCount, this.instanceCount);
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  resize(width: number, height: number, _devicePixelRatio: number): void {
    if (!this.device) {
      return;
    }
    if (width === this.size.width && height === this.size.height) {
      return;
    }
    this.size = { width, height };
    this.configureContext();
    this.depthTexture = this.device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  dispose(): void {
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.instanceBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.depthTexture?.destroy();
  }

  private writeBuffer(buffer: GPUBuffer, data: ArrayBufferView): void {
    if (!this.device) {
      return;
    }
    this.device.queue.writeBuffer(
      buffer,
      0,
      data.buffer as ArrayBuffer,
      data.byteOffset,
      data.byteLength
    );
  }

  private configureContext(): void {
    if (!this.context || !this.device) {
      return;
    }
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque"
    });
  }
}
