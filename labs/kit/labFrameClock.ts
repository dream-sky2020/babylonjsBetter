/** Labs simulate foreground time, never the time spent hidden or suspended. */
export class LabFrameClock {
  private resumePending = true;

  reset(): void { this.resumePending = true; }

  next(deltaSeconds: number, hidden: boolean): number | null {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Lab 帧时间必须为非负有限数。');
    if (hidden) { this.reset(); return null; }
    // Visibility events cover tab changes; a long gap also covers OS sleep and
    // browser suspension where no visibility event was delivered.
    if (this.resumePending || deltaSeconds > 1) {
      this.resumePending = false;
      return 0;
    }
    return deltaSeconds;
  }
}
