import { Vector3 } from '@babylonjs/core';
import { defineMonsterDeath } from '../../defineMonsterDeath';
import { easeOut, fadeAfter, number, sample, smooth, text } from '../shared';

export default defineMonsterDeath({
  id: 'knockback',
  name: '击飞倒地',
  description: '怪物被冲击抛向一侧，在空中翻转，落地后短暂回弹并淡出。',
  version: 1,
  parameters: {
    duration: { type: 'number', label: '总时长 / 秒', default: 1.35, min: 0.2, max: 8, step: 0.05, group: '时间' },
    impactRatio: { type: 'number', label: '落地时间点', default: 0.68, min: 0.25, max: 0.9, step: 0.01, group: '时间' },
    fadeStart: { type: 'number', label: '淡出起点', default: 0.82, min: 0, max: 0.98, step: 0.01, group: '时间' },
    side: { type: 'select', label: '击飞方向', default: 'right', options: [{ value: 'left', label: '向左' }, { value: 'right', label: '向右' }], group: '轨迹' },
    distance: { type: 'number', label: '水平距离', default: 4.2, min: 0, max: 16, step: 0.1, group: '轨迹' },
    height: { type: 'number', label: '抛物线高度', default: 4.8, min: 0, max: 18, step: 0.1, group: '轨迹' },
    spinTurns: { type: 'number', label: '空中翻转圈数', default: 0.85, min: -4, max: 4, step: 0.05, group: '姿态' },
    landingSquash: { type: 'number', label: '落地压扁', default: 0.28, min: 0, max: 0.8, step: 0.01, group: '姿态' },
    bounceHeight: { type: 'number', label: '落地回弹', default: 0.42, min: 0, max: 3, step: 0.05, group: '姿态' },
    hitColor: { type: 'color', label: '冲击染色', default: '#ff3b30', group: '颜色' },
    hitFlash: { type: 'number', label: '冲击染色强度', default: 0.72, min: 0, max: 1, step: 0.01, group: '颜色' }
  },
  sample: ({ progress: p }, parameters) => {
    const impact = number(parameters, 'impactRatio', 0.68);
    const sign = text(parameters, 'side', 'right') === 'left' ? -1 : 1;
    const distance = number(parameters, 'distance', 4.2);
    const height = number(parameters, 'height', 4.8);
    const turns = number(parameters, 'spinTurns', 0.85);
    let x: number, y: number, rotation: number, squash = 0;
    if (p < impact) {
      const q = p / impact;
      x = sign * distance * easeOut(q);
      y = Math.sin(q * Math.PI) * height;
      rotation = sign * turns * Math.PI * 2 * easeOut(q);
    } else {
      const q = smooth((p - impact) / (1 - impact));
      x = sign * distance;
      y = Math.abs(Math.sin(q * Math.PI * 2)) * number(parameters, 'bounceHeight', 0.42) * (1 - q);
      rotation = sign * turns * Math.PI * 2;
      squash = number(parameters, 'landingSquash', 0.28) * Math.sin(q * Math.PI) * (1 - q);
    }
    return sample({
      visualOffset: new Vector3(x, y, 0),
      rotationZ: rotation,
      scaleX: 1 + squash,
      scaleY: 1 - squash,
      scaleZ: 1,
      opacity: fadeAfter(p, number(parameters, 'fadeStart', 0.82)),
      overlayColor: text(parameters, 'hitColor', '#ff3b30'),
      overlayStrength: number(parameters, 'hitFlash', 0.72) * Math.pow(1 - p, 5)
    });
  }
});
