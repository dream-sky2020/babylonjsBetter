import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  ANCHOR_MAX,
  ANCHOR_MIN,
  BOUNDS_MAX,
  BOUNDS_MIN,
  clamp,
  toFixedNumber,
  type SpriteAnchorPreset
} from '@/core/sprite';

interface UseClipboardActionsParams {
  preset: SpriteAnchorPreset;
  setPreset: Dispatch<SetStateAction<SpriteAnchorPreset>>;
  setPresetSourceLabel: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
}

interface UseClipboardActionsResult {
  copyCurrentPreset: () => Promise<void>;
  pastePreset: () => Promise<void>;
}

export const useClipboardActions = ({
  preset,
  setPreset,
  setPresetSourceLabel,
  setMessage
}: UseClipboardActionsParams): UseClipboardActionsResult => {
  const copyCurrentPreset = useCallback(async () => {
    try {
      const dataToCopy = {
        anchors: preset.anchors,
        bodyBounds: preset.bodyBounds,
        bodyAxisX: preset.bodyAxisX
      };
      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      setMessage('已将当前锚点与包围盒配置复制到剪贴板');
    } catch (error) {
      setMessage(`复制失败: ${String(error)}`);
    }
  }, [preset, setMessage]);

  const pastePreset = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setMessage('粘贴失败: 剪贴板为空');
        return;
      }

      const parsed = JSON.parse(text) as {
        anchors?: {
          head?: { u?: number; v?: number };
          foot?: { u?: number; v?: number };
          center?: { u?: number; v?: number };
        };
        bodyBounds?: { minU?: number; maxU?: number; minV?: number; maxV?: number };
        bodyAxisX?: number;
      };

      const isValidNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

      if (
        !parsed.anchors ||
        !parsed.bodyBounds ||
        !isValidNumber(parsed.bodyAxisX) ||
        !isValidNumber(parsed.anchors.head?.u) ||
        !isValidNumber(parsed.anchors.head?.v) ||
        !isValidNumber(parsed.anchors.foot?.u) ||
        !isValidNumber(parsed.anchors.foot?.v) ||
        !isValidNumber(parsed.anchors.center?.u) ||
        !isValidNumber(parsed.anchors.center?.v) ||
        !isValidNumber(parsed.bodyBounds.minU) ||
        !isValidNumber(parsed.bodyBounds.maxU) ||
        !isValidNumber(parsed.bodyBounds.minV) ||
        !isValidNumber(parsed.bodyBounds.maxV)
      ) {
        setMessage('粘贴失败: 剪贴板中的数据不是有效的锚点配置结构');
        return;
      }

      const normalizeBounds = (minValue: number, maxValue: number) => {
        const safeMin = clamp(Math.min(minValue, maxValue), BOUNDS_MIN, BOUNDS_MAX);
        const safeMax = clamp(Math.max(minValue, maxValue), BOUNDS_MIN, BOUNDS_MAX);
        return { min: toFixedNumber(safeMin), max: toFixedNumber(safeMax) };
      };

      const normalizedU = normalizeBounds(parsed.bodyBounds.minU, parsed.bodyBounds.maxU);
      const normalizedV = normalizeBounds(parsed.bodyBounds.minV, parsed.bodyBounds.maxV);
      const safeAnchors = parsed.anchors;
      const safeBodyAxisX = parsed.bodyAxisX;

      setPreset((prev) => ({
        ...prev,
        anchors: {
          head: {
            u: toFixedNumber(clamp(safeAnchors.head!.u!, ANCHOR_MIN, ANCHOR_MAX)),
            v: toFixedNumber(clamp(safeAnchors.head!.v!, ANCHOR_MIN, ANCHOR_MAX))
          },
          foot: {
            u: toFixedNumber(clamp(safeAnchors.foot!.u!, ANCHOR_MIN, ANCHOR_MAX)),
            v: toFixedNumber(clamp(safeAnchors.foot!.v!, ANCHOR_MIN, ANCHOR_MAX))
          },
          center: {
            u: toFixedNumber(clamp(safeAnchors.center!.u!, ANCHOR_MIN, ANCHOR_MAX)),
            v: toFixedNumber(clamp(safeAnchors.center!.v!, ANCHOR_MIN, ANCHOR_MAX))
          }
        },
        bodyBounds: {
          minU: normalizedU.min,
          maxU: normalizedU.max,
          minV: normalizedV.min,
          maxV: normalizedV.max
        },
        bodyAxisX: toFixedNumber(clamp(safeBodyAxisX, ANCHOR_MIN, ANCHOR_MAX))
      }));
      setPresetSourceLabel('当前配置来源：从剪贴板粘贴（未保存）');
      setMessage('已成功粘贴剪贴板配置，请记得保存到本地');
    } catch (error) {
      setMessage(`粘贴失败: ${String(error)}`);
    }
  }, [setMessage, setPreset, setPresetSourceLabel]);

  return {
    copyCurrentPreset,
    pastePreset
  };
};
