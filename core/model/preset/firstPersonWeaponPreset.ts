export type Vec3 = { x: number; y: number; z: number };
export type ProxyShape = 'box' | 'gun' | 'cylinder' | 'capsule' | 'sphere';
export type InteractionVolumeShape = 'box' | 'cylinder' | 'capsule' | 'sphere';
export type InteractionVolume = { enabled: boolean; shape: InteractionVolumeShape; center: Vec3; size: Vec3; rotation: Vec3 };
export type MuzzleAnchor = { enabled: boolean; position: Vec3; rotation: Vec3 };
export type WeaponProxy = {
  shape: ProxyShape; size: Vec3; center: Vec3; rotation: Vec3;
  gripVolume: InteractionVolume; attackVolume: InteractionVolume; muzzle: MuzzleAnchor;
};
type LegacyWeaponProxy = { shape: ProxyShape; size: Vec3; center: Vec3; grip: Vec3; tip: Vec3 };
export type WeaponKeyframe = { id: string; time: number; label: string; position: Vec3; rotation: Vec3 };
type LegacyWeaponProject = {
  version: 1; name: string; duration: number; loop: boolean; playbackSpeed: number;
  proxy: LegacyWeaponProxy;
  /** Instance installation only; asset normalization remains in modelAssetProfiles.json. */
  asset: { path: string; name: string; scale: number; offset: Vec3; rotation: Vec3 };
  keyframes: WeaponKeyframe[];
};
export type WeaponHand = 'right' | 'left';
export type WeaponTrack = { enabled: boolean; proxy: WeaponProxy; asset: LegacyWeaponProject['asset']; keyframes: WeaponKeyframe[] };
export type AnimationProject = Pick<LegacyWeaponProject, 'name' | 'duration' | 'loop' | 'playbackSpeed'> & {
  version: 3; weapons: Record<WeaponHand, WeaponTrack>;
};
export type WeaponPresetLibrary = Record<string, AnimationProject>;
const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const proxyTemplates: Record<string, WeaponProxy> = {
  '剑 / 刀': { shape: 'box', size: vec(.12, .06, 1.5), center: vec(0, 0, .55), rotation: vec(), gripVolume: { enabled: true, shape: 'cylinder', center: vec(0, 0, -.1), size: vec(.12, .12, .28), rotation: vec() }, attackVolume: { enabled: true, shape: 'box', center: vec(0, 0, .72), size: vec(.15, .1, 1.12), rotation: vec() }, muzzle: { enabled: false, position: vec(0, 0, 1.3), rotation: vec() } },
  '枪械': { shape: 'gun', size: vec(.18, .2, .8), center: vec(0, 0, .25), rotation: vec(), gripVolume: { enabled: true, shape: 'box', center: vec(0, -.2, 0), size: vec(.16, .32, .16), rotation: vec(-18, 0, 0) }, attackVolume: { enabled: false, shape: 'box', center: vec(0, 0, .35), size: vec(.2, .2, .65), rotation: vec() }, muzzle: { enabled: true, position: vec(0, 0, .65), rotation: vec() } },
  '法杖': { shape: 'cylinder', size: vec(.09, .09, 1.6), center: vec(0, 0, .4), rotation: vec(), gripVolume: { enabled: true, shape: 'cylinder', center: vec(), size: vec(.12, .12, .3), rotation: vec() }, attackVolume: { enabled: false, shape: 'cylinder', center: vec(0, 0, .7), size: vec(.15, .15, .5), rotation: vec() }, muzzle: { enabled: true, position: vec(0, 0, 1.2), rotation: vec() } },
  '拳套 / 道具': { shape: 'sphere', size: vec(.28, .24, .3), center: vec(0, 0, .08), rotation: vec(), gripVolume: { enabled: true, shape: 'box', center: vec(), size: vec(.14, .12, .18), rotation: vec() }, attackVolume: { enabled: true, shape: 'box', center: vec(0, 0, .18), size: vec(.32, .28, .28), rotation: vec() }, muzzle: { enabled: false, position: vec(0, 0, .23), rotation: vec() } },
};

const migrateLegacyProxy = (proxy: LegacyWeaponProxy): WeaponProxy => {
  const migrated = structuredClone(proxy.shape === 'gun' ? proxyTemplates['枪械'] : proxy.shape === 'cylinder' ? proxyTemplates['法杖'] : proxy.shape === 'sphere' ? proxyTemplates['拳套 / 道具'] : proxyTemplates['剑 / 刀']);
  migrated.shape = proxy.shape; migrated.size = proxy.size; migrated.center = proxy.center; migrated.gripVolume.center = proxy.grip;
  if (proxy.shape === 'gun') migrated.muzzle.position = proxy.tip;
  else migrated.attackVolume.center = { x: (proxy.center.x + proxy.tip.x) / 2, y: (proxy.center.y + proxy.tip.y) / 2, z: (proxy.center.z + proxy.tip.z) / 2 };
  return migrated;
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

function parseSemanticProxy(value: unknown): WeaponProxy {
  const fail = (field: string): never => { throw new Error(`武器语义体字段无效：${field}`); };
  const exact = (v: unknown, keys: string[], field: string): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== keys.length || Object.keys(v).some(key => !keys.includes(key))) return fail(field);
    return v as Record<string, unknown>;
  };
  const number = (v: unknown, field: string, positive = false) => typeof v === 'number' && Number.isFinite(v) && (!positive || v > 0) ? v : fail(field);
  const vector = (v: unknown, field: string, positive = false): Vec3 => { const o = exact(v, ['x', 'y', 'z'], field); return { x: number(o.x, field, positive), y: number(o.y, field, positive), z: number(o.z, field, positive) }; };
  const rawRoot = value as Record<string, unknown>;
  const rootKeys = rawRoot && Object.prototype.hasOwnProperty.call(rawRoot, 'rotation')
    ? ['shape', 'size', 'center', 'rotation', 'gripVolume', 'attackVolume', 'muzzle']
    : ['shape', 'size', 'center', 'gripVolume', 'attackVolume', 'muzzle'];
  const root = exact(value, rootKeys, 'proxy');
  if (!['box', 'gun', 'cylinder', 'capsule', 'sphere'].includes(String(root.shape))) fail('proxy.shape');
  const volume = (raw: unknown, field: string): InteractionVolume => {
    const v = exact(raw, ['enabled', 'shape', 'center', 'size', 'rotation'], field);
    if (typeof v.enabled !== 'boolean' || !['box', 'cylinder', 'capsule', 'sphere'].includes(String(v.shape))) fail(field);
    return { enabled: v.enabled, shape: v.shape as InteractionVolumeShape, center: vector(v.center, `${field}.center`), size: vector(v.size, `${field}.size`, true), rotation: vector(v.rotation, `${field}.rotation`) };
  };
  const muzzle = exact(root.muzzle, ['enabled', 'position', 'rotation'], 'muzzle');
  if (typeof muzzle.enabled !== 'boolean') fail('muzzle.enabled');
  return { shape: root.shape as ProxyShape, size: vector(root.size, 'proxy.size', true), center: vector(root.center, 'proxy.center'), rotation: root.rotation === undefined ? vec() : vector(root.rotation, 'proxy.rotation'),
    gripVolume: volume(root.gripVolume, 'gripVolume'), attackVolume: volume(root.attackVolume, 'attackVolume'),
    muzzle: { enabled: muzzle.enabled, position: vector(muzzle.position, 'muzzle.position'), rotation: vector(muzzle.rotation, 'muzzle.rotation') } };
}

export function parseWeaponProject(value: unknown): AnimationProject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('武器预设必须为对象');
  const p = value as Record<string, unknown>;
  if (p.version === 1) {
    const legacy = parseLegacyProject(value);
    const right: WeaponTrack = { enabled: true, proxy: migrateLegacyProxy(legacy.proxy), asset: legacy.asset, keyframes: legacy.keyframes };
    return { version: 3, name: legacy.name, duration: legacy.duration, loop: legacy.loop, playbackSpeed: legacy.playbackSpeed,
      weapons: { right, left: { ...mirrorWeaponTrack(right), enabled: false } } };
  }
  const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k)));
  if (![2, 3].includes(p.version as number) || !exact(p, ['version', 'name', 'duration', 'loop', 'playbackSpeed', 'weapons']) || !exact(p.weapons, ['right', 'left'])) throw new Error('无效的双武器预设');
  const weapons = {} as Record<WeaponHand, WeaponTrack>;
  for (const hand of ['right', 'left'] as const) {
    const track = p.weapons[hand];
    if (!exact(track, ['enabled', 'proxy', 'asset', 'keyframes']) || typeof track.enabled !== 'boolean') throw new Error('无效的武器轨道：' + hand);
    if (p.version === 2) {
      const parsed = parseLegacyProject({ version: 1, name: p.name, duration: p.duration, loop: p.loop, playbackSpeed: p.playbackSpeed, proxy: track.proxy, asset: track.asset, keyframes: track.keyframes });
      weapons[hand] = { enabled: track.enabled, proxy: migrateLegacyProxy(parsed.proxy), asset: parsed.asset, keyframes: parsed.keyframes };
    } else {
      const proxy = parseSemanticProxy(track.proxy);
      const legacyProxy: LegacyWeaponProxy = { shape: proxy.shape, size: proxy.size, center: proxy.center, grip: proxy.gripVolume.center, tip: proxy.muzzle.enabled ? proxy.muzzle.position : proxy.attackVolume.center };
      const parsed = parseLegacyProject({ version: 1, name: p.name, duration: p.duration, loop: p.loop, playbackSpeed: p.playbackSpeed, proxy: legacyProxy, asset: track.asset, keyframes: track.keyframes });
      weapons[hand] = { enabled: track.enabled, proxy, asset: parsed.asset, keyframes: parsed.keyframes };
    }
  }
  if (!weapons.right.enabled && !weapons.left.enabled) throw new Error('至少启用一个武器代理体');
  return { version: 3, name: p.name as string, duration: p.duration as number, loop: p.loop as boolean, playbackSpeed: p.playbackSpeed as number, weapons };
}

export function parseWeaponLibrary(value: unknown): WeaponPresetLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('武器预设库必须为对象');
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error(`无效预设 Key：${key}`);
    return [key, parseWeaponProject(entry)];
  }));
}
