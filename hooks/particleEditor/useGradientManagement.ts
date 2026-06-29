import { useCallback, useMemo, useState } from 'react';
import type { ParticleEditorPreset } from '@app-types/particle-editor.types';
import { clamp, createGradientNodeId, hexToRgb, lerp, toFixedNumber } from '../../utils/particleEditorHelpers';
import type { ColorGradientNode, SetPresetState, SizeGradientNode } from './types';

interface UseGradientManagementParams {
  initialPreset: ParticleEditorPreset;
  setPreset: SetPresetState;
}

interface UseGradientManagementResult {
  colorGradientNodes: ColorGradientNode[];
  sizeGradientNodes: SizeGradientNode[];
  colorPreviewGradientCss: string;
  sizePreviewSamples: number[];
  refreshGradientNodes: (nextPreset: ParticleEditorPreset) => void;
  updateColorGradient: (nodeId: string, key: 'offset' | 'colorHex' | 'alpha', value: string) => void;
  addColorGradient: () => void;
  removeColorGradient: (nodeId: string) => void;
  updateSizeGradient: (nodeId: string, key: 'offset' | 'size', value: number) => void;
  addSizeGradient: () => void;
  removeSizeGradient: (nodeId: string) => void;
  sortColorGradientsByOffset: () => void;
  sortSizeGradientsByOffset: () => void;
}

export const useGradientManagement = ({
  initialPreset,
  setPreset
}: UseGradientManagementParams): UseGradientManagementResult => {
  const toColorGradientNodes = useCallback((gradients: ParticleEditorPreset['colorGradients']): ColorGradientNode[] => {
    return gradients.map((item) => ({ ...item, id: createGradientNodeId('cg') }));
  }, []);

  const toSizeGradientNodes = useCallback((gradients: ParticleEditorPreset['sizeGradients']): SizeGradientNode[] => {
    return gradients.map((item) => ({ ...item, id: createGradientNodeId('sg') }));
  }, []);

  const fromColorGradientNodes = useCallback((nodes: ColorGradientNode[]): ParticleEditorPreset['colorGradients'] => {
    return nodes.map((node) => ({
      offset: node.offset,
      color: {
        r: node.color.r,
        g: node.color.g,
        b: node.color.b,
        a: node.color.a
      }
    }));
  }, []);

  const fromSizeGradientNodes = useCallback((nodes: SizeGradientNode[]): ParticleEditorPreset['sizeGradients'] => {
    return nodes.map((node) => ({
      offset: node.offset,
      size: node.size
    }));
  }, []);

  const [colorGradientNodes, setColorGradientNodes] = useState<ColorGradientNode[]>(
    () => initialPreset.colorGradients.map((item, index) => ({ ...item, id: `cg-init-${index}` }))
  );
  const [sizeGradientNodes, setSizeGradientNodes] = useState<SizeGradientNode[]>(
    () => initialPreset.sizeGradients.map((item, index) => ({ ...item, id: `sg-init-${index}` }))
  );

  const colorPreviewGradientCss = useMemo(() => {
    if (colorGradientNodes.length === 0) return 'linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0))';
    const sorted = [...colorGradientNodes].sort((a, b) => a.offset - b.offset);
    return `linear-gradient(90deg, ${sorted.map((entry) => {
      const stop = clamp(entry.offset, 0, 1) * 100;
      const r = clamp(Math.round(entry.color.r * 255), 0, 255);
      const g = clamp(Math.round(entry.color.g * 255), 0, 255);
      const b = clamp(Math.round(entry.color.b * 255), 0, 255);
      const a = clamp(entry.color.a, 0, 1);
      return `rgba(${r}, ${g}, ${b}, ${a}) ${stop}%`;
    }).join(', ')})`;
  }, [colorGradientNodes]);

  const sizePreviewSamples = useMemo(() => {
    const sorted = [...sizeGradientNodes].sort((a, b) => a.offset - b.offset);
    if (sorted.length === 0) return new Array(48).fill(0.5);
    if (sorted.length === 1) return new Array(48).fill(clamp(sorted[0].size, 0.0001, 9999));

    const evaluateSizeAt = (t: number): number => {
      if (t <= sorted[0].offset) return sorted[0].size;
      const last = sorted[sorted.length - 1];
      if (t >= last.offset) return last.size;
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const left = sorted[i];
        const right = sorted[i + 1];
        if (t >= left.offset && t <= right.offset) {
          const range = Math.max(right.offset - left.offset, 0.0001);
          const localT = (t - left.offset) / range;
          return lerp(left.size, right.size, localT);
        }
      }
      return last.size;
    };

    const samples = 48;
    const values = Array.from({ length: samples }, (_, index) => {
      const t = samples <= 1 ? 0 : index / (samples - 1);
      return evaluateSizeAt(t);
    });
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(maxValue - minValue, 0.0001);
    return values.map((value) => (value - minValue) / range);
  }, [sizeGradientNodes]);

  const refreshGradientNodes = useCallback((nextPreset: ParticleEditorPreset) => {
    setColorGradientNodes(toColorGradientNodes(nextPreset.colorGradients));
    setSizeGradientNodes(toSizeGradientNodes(nextPreset.sizeGradients));
  }, [toColorGradientNodes, toSizeGradientNodes]);

  const updateColorGradient = useCallback((nodeId: string, key: 'offset' | 'colorHex' | 'alpha', value: string) => {
    setColorGradientNodes((prev) => {
      const next = prev.map((node) => {
        if (node.id !== nodeId) return node;
        if (key === 'colorHex') {
          const { r, g, b } = hexToRgb(value);
          return { ...node, color: { ...node.color, r, g, b } };
        }
        if (key === 'alpha') {
          return { ...node, color: { ...node.color, a: toFixedNumber(clamp(Number(value) || 0, 0, 1)) } };
        }
        return { ...node, offset: toFixedNumber(clamp(Number(value) || 0, 0, 1)) };
      });
      setPreset((presetPrev) => ({ ...presetPrev, colorGradients: fromColorGradientNodes(next) }));
      return next;
    });
  }, [fromColorGradientNodes, setPreset]);

  const addColorGradient = useCallback(() => {
    setColorGradientNodes((prev) => {
      const next = [
        ...prev,
        { id: createGradientNodeId('cg'), offset: 1, color: { r: 1, g: 1, b: 1, a: 1 } }
      ];
      setPreset((presetPrev) => ({ ...presetPrev, colorGradients: fromColorGradientNodes(next) }));
      return next;
    });
  }, [fromColorGradientNodes, setPreset]);

  const removeColorGradient = useCallback((nodeId: string) => {
    setColorGradientNodes((prev) => {
      const next = prev.filter((node) => node.id !== nodeId);
      setPreset((presetPrev) => ({ ...presetPrev, colorGradients: fromColorGradientNodes(next) }));
      return next;
    });
  }, [fromColorGradientNodes, setPreset]);

  const updateSizeGradient = useCallback((nodeId: string, key: 'offset' | 'size', value: number) => {
    setSizeGradientNodes((prev) => {
      const safeValue = key === 'offset'
        ? toFixedNumber(clamp(value, 0, 1))
        : toFixedNumber(Math.max(0.0001, value));
      const next = prev.map((node) => node.id === nodeId ? { ...node, [key]: safeValue } : node);
      setPreset((presetPrev) => ({ ...presetPrev, sizeGradients: fromSizeGradientNodes(next) }));
      return next;
    });
  }, [fromSizeGradientNodes, setPreset]);

  const addSizeGradient = useCallback(() => {
    setSizeGradientNodes((prev) => {
      const next = [...prev, { id: createGradientNodeId('sg'), offset: 1, size: 1 }];
      setPreset((presetPrev) => ({ ...presetPrev, sizeGradients: fromSizeGradientNodes(next) }));
      return next;
    });
  }, [fromSizeGradientNodes, setPreset]);

  const removeSizeGradient = useCallback((nodeId: string) => {
    setSizeGradientNodes((prev) => {
      const next = prev.filter((node) => node.id !== nodeId);
      setPreset((presetPrev) => ({ ...presetPrev, sizeGradients: fromSizeGradientNodes(next) }));
      return next;
    });
  }, [fromSizeGradientNodes, setPreset]);

  const sortColorGradientsByOffset = useCallback(() => {
    setColorGradientNodes((prev) => {
      const next = [...prev].sort((a, b) => a.offset - b.offset);
      setPreset((presetPrev) => ({ ...presetPrev, colorGradients: fromColorGradientNodes(next) }));
      return next;
    });
  }, [fromColorGradientNodes, setPreset]);

  const sortSizeGradientsByOffset = useCallback(() => {
    setSizeGradientNodes((prev) => {
      const next = [...prev].sort((a, b) => a.offset - b.offset);
      setPreset((presetPrev) => ({ ...presetPrev, sizeGradients: fromSizeGradientNodes(next) }));
      return next;
    });
  }, [fromSizeGradientNodes, setPreset]);

  return {
    colorGradientNodes,
    sizeGradientNodes,
    colorPreviewGradientCss,
    sizePreviewSamples,
    refreshGradientNodes,
    updateColorGradient,
    addColorGradient,
    removeColorGradient,
    updateSizeGradient,
    addSizeGradient,
    removeSizeGradient,
    sortColorGradientsByOffset,
    sortSizeGradientsByOffset
  };
};
