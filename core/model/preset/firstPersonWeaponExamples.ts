import { mirrorWeaponTrack, proxyTemplates, type AnimationProject, type Vec3, type WeaponKeyframe, type WeaponTrack, type WeaponPresetLibrary } from './firstPersonWeaponPreset.ts';

const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const frame = (id: string, time: number, label: string, position: Vec3, rotation = v()): WeaponKeyframe => ({ id, time, label, position, rotation });
const track = (template: string, keyframes: WeaponKeyframe[]): WeaponTrack => ({ enabled: true,
  proxy: structuredClone(proxyTemplates[template]),
  asset: { path: '', name: '武器代理体', scale: 1, offset: v(), rotation: v() }, keyframes,
});
const project = (name: string, duration: number, right: WeaponTrack, left = { ...mirrorWeaponTrack(right), enabled: false }): AnimationProject => ({
  version: 3, name, duration, loop: false, playbackSpeed: 1, weapons: { right, left },
});
const slash = () => track('剑 / 刀', [
  frame('ready', 0, '预备', v(.43, -.3, .82), v(-12, 8, -7)),
  frame('windup', .18, '蓄力', v(.54, -.24, .72), v(-25, 35, 25)),
  frame('contact', .4, '命中', v(-.18, -.19, .64), v(12, -52, -64)),
  frame('follow', .56, '随挥', v(-.42, -.28, .78), v(24, -70, -82)),
  frame('recover', .82, '复位', v(.43, -.3, .82), v(-12, 8, -7)),
]);
const delayed = (source: WeaponTrack, delay: number, duration: number): WeaponTrack => {
  const copy = structuredClone(source);
  copy.keyframes = [ { ...structuredClone(copy.keyframes[0]), id: 'hold', time: 0, label: '等待另一手' },
    ...copy.keyframes.map(f => ({ ...f, time: Number((f.time + delay).toFixed(3)) })),
    { ...structuredClone(copy.keyframes.at(-1)!), id: 'end', time: duration, label: '复位保持' } ];
  return copy;
};
const shoot = (shots: number, spacing: number, duration: number) => {
  const rest = v(.3, -.24, .7);
  const frames = [frame('ready', 0, '瞄准', rest)];
  for (let i = 0; i < shots; i++) {
    const t = .08 + i * spacing;
    frames.push(frame(`fire-${i}`, t, `射击 ${i + 1}`, rest),
      frame(`kick-${i}`, Number((t + .035).toFixed(3)), '后坐 / 枪口上跳', v(.3, -.22, .59), v(-9, 0, 1.5)),
      frame(`settle-${i}`, Number((t + .13).toFixed(3)), '回落', v(.3, -.25, .69), v(1, 0, -.5)));
  }
  frames.push(frame('recover', duration, '恢复瞄准', rest));
  return track('枪械', frames);
};

/** Fresh editable examples: applying one replaces the whole rig, including model installations. */
export function createWeaponAnimationExamples(): WeaponPresetLibrary {
  const right = slash();
  const alternatingRight = structuredClone(right);
  alternatingRight.keyframes.push({ ...structuredClone(right.keyframes[0]), id: 'hold-end', time: 1.4, label: '等待左手收势' });
  const crossRight = slash();
  crossRight.keyframes[2].position.x = -.08;
  crossRight.keyframes[2].position.y = -.1;
  const crossLeft = mirrorWeaponTrack(crossRight);
  // A slight height difference keeps the debug bodies readable at the crossing.
  crossLeft.keyframes = crossLeft.keyframes.map(f => ({ ...f, position: { ...f.position, y: f.position.y - .1 } }));
  const pistol = shoot(1, .2, .48);
  const dualRight = structuredClone(pistol);
  dualRight.keyframes.push(frame('hold-end', 1, '等待左枪', v(.3, -.24, .7)));
  return {
    'right-hand-slash': project('右手横斩', .82, right),
    'dual-alternating-slash': project('双持 · 左右交替斩', 1.4, alternatingRight, delayed(mirrorWeaponTrack(right), .45, 1.4)),
    'dual-cross-slash': project('双持 · 交叉斩', .82, crossRight, crossLeft),
    'pistol-single-shot': project('枪械 · 单发后坐', .48, pistol),
    'rifle-three-round-burst': project('枪械 · 三连发', .8, shoot(3, .2, .8)),
    'dual-pistol-alternating': project('双枪 · 交替射击', 1, dualRight, delayed(mirrorWeaponTrack(pistol), .35, 1)),
  };
}
