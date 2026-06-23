// trackers/UiTrackerManager.ts
import { UiTracker } from './UiTracker';

export class UiTrackerManager {
  private trackers: UiTracker[] = [];

  /** 添加追踪器 */
  addTracker(tracker: UiTracker): void {
    this.trackers.push(tracker);
  }

  /** 移除追踪器 */
  removeTracker(tracker: UiTracker): void {
    const index = this.trackers.indexOf(tracker);
    if (index !== -1) {
      this.trackers.splice(index, 1);
    }
  }

  /** 通过目标对象移除追踪器 */
  removeTrackerByTarget(target: any): void {
    this.trackers = this.trackers.filter(
      tracker => tracker.getTarget() !== target
    );
  }

  /** 更新所有追踪器 */
  updateAll(): void {
    this.trackers.forEach(tracker => tracker.update());
  }

  /** 清空所有追踪器 */
  clear(): void {
    this.trackers = [];
  }

  /** 获取所有追踪器 */
  getTrackers(): UiTracker[] {
    return [...this.trackers];
  }

  /** 获取追踪器数量 */
  getCount(): number {
    return this.trackers.length;
  }
}