export type Vec3 = { x: number; y: number; z: number };
export type ProxyShape = 'box' | 'gun' | 'cylinder' | 'capsule' | 'sphere';
export type WeaponProxy = {
  shape: ProxyShape; size: Vec3; center: Vec3; grip: Vec3; tip: Vec3;
};
export type WeaponKeyframe = { id: string; time: number; label: string; position: Vec3; rotation: Vec3 };
type LegacyWeaponProject = {
  version: 1; name: string; duration: number; loop: boolean; playbackSpeed: number;
  proxy: WeaponProxy;
  /** Instance installation only; asset normalization remains in modelAssetProfiles.json. */
  asset: { path: string; name: string; scale: number; offset: Vec3; rotation: Vec3 };
  keyframes: WeaponKeyframe[];
};
export type WeaponHand = 'right' | 'left';
export type WeaponTrack = Pick<LegacyWeaponProject, 'proxy' | 'asset' | 'keyframes'> & { enabled: boolean };
export type AnimationProject = Pick<LegacyWeaponProject, 'name' | 'duration' | 'loop' | 'playbackSpeed'> & {
  version: 2; weapons: Record<WeaponHand, WeaponTrack>;
};
export type WeaponPresetLibrary = Record<string, AnimationProject>;
const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const proxyTemplates: Record<string, WeaponProxy> = {
  '剑 / 刀': { shape: 'box', size: vec(.12, .06, 1.5), center: vec(0, 0, .55), grip: vec(0, 0, -.1), tip: vec(0, 0, 1.3) },
  '枪械': { shape: 'gun', size: vec(.18, .2, .8), center: vec(0, 0, .25), grip: vec(0, -.2, 0), tip: vec(0, 0, .65) },
  '法杖': { shape: 'cylinder', size: vec(.09, .09, 1.6), center: vec(0, 0, .4), grip: vec(), tip: vec(0, 0, 1.2) },
  '拳套 / 道具': { shape: 'sphere', size: vec(.28, .24, .3), center: vec(0, 0, .08), grip: vec(), tip: vec(0, 0, .23) },
};

function parseLegacyProject(value: unknown): LegacyWeaponProject {
  const fail = (field: string): never => { throw new Error(`武器预设字段无效：${field}`); };
  const obj = (v: unknown, keys: string[], field: string): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) return fail(field);
    return v as Record<string, unknown>;
  };
  const number = (v: unknown, field: string, positive = false): number => typeof v === 'number' && Number.isFinite(v) && (!positive || v > 0) ? v : fail(field);
  const string = (v: unknown, field: string): string => typeof v === 'string' ? v : fail(field);
  const vector = (v: unknown, field: string, positive = false): Vec3 => { const o = obj(v, ['x', 'y', 'z'], field); return { x: number(o.x, field, positive), y: number(o.y, field, positive), z: number(o.z, field, positive) }; };
  const p = obj(value, ['version', 'name', 'duration', 'loop', 'playbackSpeed', 'proxy', 'asset', 'keyframes'], 'project');
  if (p.version !== 1 || typeof p.loop !== 'boolean') fail('version / loop');
  const duration = number(p.duration, 'duration', true);
  const a = obj(p.asset, ['path', 'name', 'scale', 'offset', 'rotation'], 'asset');
  const path = string(a.path, 'asset.path');
  if (path && (!/^\/resources\/.+\.(glb|gltf)$/i.test(path) || path.includes('..') || path.includes('\\'))) fail('asset.path');
  const proxy = obj(p.proxy, ['shape', 'size', 'center', 'grip', 'tip'], 'proxy');
  if (!['box', 'gun', 'cylinder', 'capsule', 'sphere'].includes(String(proxy.shape))) fail('proxy.shape');
  if (!Array.isArray(p.keyframes) || p.keyframes.length < 2) fail('keyframes');
  const ids = new Set<string>();
  const keyframes = (p.keyframes as unknown[]).map(v => {
    const f = obj(v, ['id', 'time', 'label', 'position', 'rotation'], 'keyframe');
    const id = string(f.id, 'id'); const time = number(f.time, 'time');
    if (!id || ids.has(id) || time < 0 || time > duration) fail('keyframe.id / time'); ids.add(id);
    return { id, time, label: string(f.label, 'label'), position: vector(f.position, 'position'), rotation: vector(f.rotation, 'rotation') };
  }).sort((a, b) => a.time - b.time);
  return { version: 1, name: string(p.name, 'name'), duration, loop: p.loop as boolean, playbackSpeed: number(p.playbackSpeed, 'playbackSpeed', true),
    proxy: { shape: proxy.shape as ProxyShape, size: vector(proxy.size, 'size', true), center: vector(proxy.center, 'center'), grip: vector(proxy.grip, 'grip'), tip: vector(proxy.tip, 'tip') },
    asset: { path, name: string(a.name, 'asset.name'), scale: number(a.scale, 'scale', true), offset: vector(a.offset, 'offset'), rotation: vector(a.rotation, 'rotation') }, keyframes };
}

/** Mirror camera-space motion, never mirror or renormalize the model itself. */
export function mirrorWeaponTrack(track: WeaponTrack): WeaponTrack {
  const copy = structuredClone(track);
  copy.keyframes = copy.keyframes.map(frame => ({ ...frame,
    position: { ...frame.position, x: -frame.position.x },
    rotation: { ...frame.rotation, y: -frame.rotation.y, z: -frame.rotation.z },
  }));
  return copy;
}
export function parseWeaponProject(value: unknown): AnimationProject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('武器预设必须为对象');
  const p = value as Record<string, unknown>;
  if (p.version === 1) {
    const legacy = parseLegacyProject(value);
    const right = { enabled: true, proxy: legacy.proxy, asset: legacy.asset, keyframes: legacy.keyframes };
    return { version: 2, name: legacy.name, duration: legacy.duration, loop: legacy.loop, playbackSpeed: legacy.playbackSpeed,
      weapons: { right, left: { ...mirrorWeaponTrack(right), enabled: false } } };
  }
  const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k)));
  if (p.version !== 2 || !exact(p, ['version', 'name', 'duration', 'loop', 'playbackSpeed', 'weapons']) || !exact(p.weapons, ['right', 'left'])) throw new Error('无效的 v2 双武器预设');
  const weapons = {} as Record<WeaponHand, WeaponTrack>;
  for (const hand of ['right', 'left'] as const) {
    const track = p.weapons[hand];
    if (!exact(track, ['enabled', 'proxy', 'asset', 'keyframes']) || typeof track.enabled !== 'boolean') throw new Error('无效的武器轨道：' + hand);
    const parsed = parseLegacyProject({ version: 1, name: p.name, duration: p.duration, loop: p.loop, playbackSpeed: p.playbackSpeed, proxy: track.proxy, asset: track.asset, keyframes: track.keyframes });
    weapons[hand] = { enabled: track.enabled, proxy: parsed.proxy, asset: parsed.asset, keyframes: parsed.keyframes };
  }
  if (!weapons.right.enabled && !weapons.left.enabled) throw new Error('至少启用一个武器代理体');
  return { version: 2, name: p.name as string, duration: p.duration as number, loop: p.loop as boolean, playbackSpeed: p.playbackSpeed as number, weapons };
}

export function parseWeaponLibrary(value: unknown): WeaponPresetLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('武器预设库必须为对象');
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error(`无效预设 Key：${key}`);
    return [key, parseWeaponProject(entry)];
  }));
}
