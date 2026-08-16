import { Vector3 } from '@babylonjs/core';
import { defineMonsterDeath } from '../../defineMonsterDeath';
import { fadeAfter, number, sample, smooth, text } from '../shared';

export default defineMonsterDeath({
  id: 'sink',
  name: '沉底消亡',
  description: '先失力压缩并左右摇晃，随后缓慢沉入地面，最后完全隐去。',
  version: 1,
  parameters: {
    duration: { type: 'number', label: '总时长 / 秒', default: 1.8, min: 0.2, max: 10, step: 0.05, group: '时间' },
    settleRatio: { type: 'number', label: '失力阶段占比', default: 0.25, min: 0.05, max: 0.7, step: 0.01, group: '时间' },
    fadeStart: { type: 'number', label: '淡出起点', default: 0.58, min: 0, max: 0.98, step: 0.01, group: '时间' },
    depth: { type: 'number', label: '下沉深度', default: 5.8, min: 0, max: 20, step: 0.1, group: '位移' },
    drift: { type: 'number', label: '水平漂移', default: 0.25, min: -5, max: 5, step: 0.05, group: '位移' },
    wobbleDeg: { type: 'number', label: '失力摇晃角度', default: 8, min: 0, max: 60, step: 1, group: '姿态' },
    wobbleCycles: { type: 'number', label: '摇晃次数', default: 2.5, min: 0, max: 12, step: 0.25, group: '姿态' },
    squash: { type: 'number', label: '失力压缩', default: 0.18, min: 0, max: 0.8, step: 0.01, group: '姿态' },
    shadowColor: { type: 'color', label: '暗化颜色', default: '#301934', group: '颜色' },
    shadowStrength: { type: 'number', label: '暗化强度', default: 0.68, min: 0, max: 1, step: 0.01, group: '颜色' }
  },
  sample: ({ progress: p }, parameters) => {
    const settle = number(parameters, 'settleRatio', 0.25);
    const sinkProgress = smooth((p - settle) / Math.max(0.001, 1 - settle));
    const settleProgress = smooth(p / settle);
    const wobble = Math.sin(p * Math.PI * 2 * number(parameters, 'wobbleCycles', 2.5))
      * number(parameters, 'wobbleDeg', 8) * Math.PI / 180 * (1 - p);
    const squash = number(parameters, 'squash', 0.18) * settleProgress * (1 - sinkProgress * 0.55);
    return sample({
      visualOffset: new Vector3(number(parameters, 'drift', 0.25) * sinkProgress, -number(parameters, 'depth', 5.8) * sinkProgress, 0),
      rotationZ: wobble,
      scaleX: 1 + squash,
      scaleY: 1 - squash,
      scaleZ: 1,
      opacity: fadeAfter(p, number(parameters, 'fadeStart', 0.58)),
      overlayColor: text(parameters, 'shadowColor', '#301934'),
      overlayStrength: number(parameters, 'shadowStrength', 0.68) * smooth(p)
    });
  }
});
