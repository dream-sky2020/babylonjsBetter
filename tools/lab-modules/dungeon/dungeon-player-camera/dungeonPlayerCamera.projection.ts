import type { CameraProjection } from '@/core/camera/cameraLabController.ts';

export type DungeonPlayerCameraProjectionSettings = {
  projection: CameraProjection;
  /** 垂直可见半范围（世界单位）；null 表示首次进入正交时由公共控制器匹配构图。 */
  orthographicSize: number | null;
};

export const validatePlayerCameraProjection = (saved: unknown, version: number): DungeonPlayerCameraProjectionSettings => {
  if (version !== 1 || !saved || typeof saved !== 'object' || Array.isArray(saved)) {
    throw new Error('玩家相机投影设置格式或版本无效');
  }
  const value = saved as Record<string, unknown>;
  if (value.projection !== 'perspective' && value.projection !== 'orthographic') throw new Error('玩家相机投影类型无效');
  if (value.orthographicSize !== null && (typeof value.orthographicSize !== 'number'
    || !Number.isFinite(value.orthographicSize) || value.orthographicSize <= 0)) throw new Error('玩家相机正交半范围必须为正数');
  return { projection: value.projection, orthographicSize: value.orthographicSize as number | null };
};
