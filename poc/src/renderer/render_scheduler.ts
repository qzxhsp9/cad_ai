export class RenderScheduler {
  private pending = false;
  private renderFn: () => void;
  private continuous = false;
  private frameHandle = 0;

  constructor(renderFn: () => void) {
    this.renderFn = renderFn;
  }

  invalidate(): void {
    if (this.continuous) {
      return;
    }
    if (this.pending) {
      return;
    }
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.renderFn();
    });
  }

  startContinuous(): void {
    if (this.continuous) {
      return;
    }
    this.continuous = true;
    const loop = () => {
      if (!this.continuous) {
        return;
      }
      this.renderFn();
      this.frameHandle = requestAnimationFrame(loop);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  stopContinuous(): void {
    this.continuous = false;
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }
}
