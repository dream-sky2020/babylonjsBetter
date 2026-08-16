import { Vector3 } from '@babylonjs/core';
import { defineMonsterDeath } from '../../defineMonsterDeath';
import { clamp01, number, sample, smooth, text } from '../shared';

export default defineMonsterDeath({
  id: 'ash',
  name: '化灰消散',
  description: '怪物先被灰白覆盖，随后四层视觉依次剥离、上浮并散成不可见的灰烬。',
  version: 1,
  parameters: {
    duration: { type: 'number', label: '总时长 / 秒', default: 2.15, min: 0.3, max: 12, step: 0.05, group: '时间' },
    dissolveStart: { type: 'number', label: '消散起点', default: 0.24, min: 0, max: 0.9, step: 0.01, group: '时间' },
    layerStagger: { type: 'number', label: '图层错峰', default: 0.32, min: 0, max: 0.7, step: 0.01, group: '时间' },
    rise: { type: 'number', label: '灰烬上浮', default: 2.6, min: 0, max: 12, step: 0.1, group: '消散' },
    spread: { type: 'number', label: '图层横向散开', default: 1.5, min: 0, max: 8, step: 0.05, group: '消散' },
    shrink: { type: 'number', label: '整体收缩', default: 0.32, min: 0, max: 1, step: 0.01, group: '消散' },
    flutter: { type: 'number', label: '飘动幅度', default: 0.28, min: 0, max: 2, step: 0.01, group: '消散' },
    ashColor: { type: 'color', label: '灰烬颜色', default: '#c7c7c7', group: '颜色' },
    ashStrength: { type: 'number', label: '灰化强度', default: 0.92, min: 0, max: 1, step: 0.01, group: '颜色' }
  },
  sample: ({ progress: p }, parameters) => {
    const start = number(parameters, 'dissolveStart', 0.24);
    const stagger = number(parameters, 'layerStagger', 0.32);
    const global = smooth((p - start) / Math.max(0.001, 1 - start));
    const rise = number(parameters, 'rise', 2.6);
    const spread = number(parameters, 'spread', 1.5);
    const flutter = number(parameters, 'flutter', 0.28);
    const layers = Array.from({ length: 4 }, (_, index) => {
      const delay = index / 3 * stagger;
      const q = smooth(clamp01((p - start - delay) / Math.max(0.001, 1 - start - delay)));
      const direction = index % 2 === 0 ? -1 : 1;
      return {
        opacity: 1 - q,
        offsetX: direction * spread * q + Math.sin(p * Math.PI * 8 + index) * flutter * q,
        offsetY: rise * q * (0.55 + index * 0.15)
      };
    });
    const scale = 1 - number(parameters, 'shrink', 0.32) * global;
    return sample({
      visualOffset: new Vector3(0, rise * global * 0.12, 0),
      rotationZ: Math.sin(p * Math.PI * 5) * flutter * 0.08 * global,
      scaleX: scale,
      scaleY: scale,
      scaleZ: scale,
      opacity: 1,
      overlayColor: text(parameters, 'ashColor', '#c7c7c7'),
      overlayStrength: number(parameters, 'ashStrength', 0.92) * smooth(p / Math.max(0.01, start + 0.12)),
      layers
    });
  }
});
