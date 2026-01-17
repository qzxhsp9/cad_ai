export class RenderScheduler {
  private pending = false;
  private renderFn: () => void;

  constructor(renderFn: () => void) {
    this.renderFn = renderFn;
  }

  invalidate(): void {
    if (this.pending) {
      return;
    }
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.renderFn();
    });
  }
}
