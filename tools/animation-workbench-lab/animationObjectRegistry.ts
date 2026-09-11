import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, type AbstractMesh, type Scene } from '@babylonjs/core';

export type AnimationObjectLayer = 'visual' | 'semantic' | 'helper';
export type AnimationObjectProperty = Readonly<{
  key: string; label: string; type: 'color' | 'number' | 'select' | 'asset'; min?: number; max?: number; step?: number;
  options?: readonly Readonly<{ value: string; label: string }>[];
}>;
export type AnimationObjectFactory = Readonly<{
  typeId: string; label: string; category: string; layer: AnimationObjectLayer; icon: 'empty' | 'object' | 'weapon' | 'volume' | 'socket' | 'model';
  defaultConfig: Readonly<Record<string, unknown>>; properties: readonly AnimationObjectProperty[];
  create(scene: Scene, name: string, config: Readonly<Record<string, unknown>>): TransformNode;
  previewSignature?(config: Readonly<Record<string, unknown>>): string;
}>;

const DISPLAY_OPTIONS = [{ value: 'solid', label: 'Solid 实体' }, { value: 'xray', label: 'X-Ray 半透明' }, { value: 'outline', label: 'Outline 轮廓' }, { value: 'hidden', label: 'Hidden 隐藏' }] as const;
const SHAPE_OPTIONS = [{ value: 'box', label: '盒体' }, { value: 'sphere', label: '球体 / 椭球' }, { value: 'cylinder', label: '圆柱体' }, { value: 'capsule', label: '胶囊体' }] as const;
const APPEARANCE_PROPERTIES: readonly AnimationObjectProperty[] = [
  { key: 'displayMode', label: '显示模式', type: 'select', options: DISPLAY_OPTIONS }, { key: 'color', label: '颜色', type: 'color' },
  { key: 'opacity', label: '透明度', type: 'number', min: .03, max: 1, step: .05 },
];
const VOLUME_PROPERTIES: readonly AnimationObjectProperty[] = [{ key: 'shape', label: '形状', type: 'select', options: SHAPE_OPTIONS }, ...APPEARANCE_PROPERTIES];
const root = (scene: Scene, name: string) => new TransformNode(name, scene);
const configString = (config: Readonly<Record<string, unknown>>, key: string, fallback: string) => typeof config[key] === 'string' ? config[key] : fallback;
const configNumber = (config: Readonly<Record<string, unknown>>, key: string, fallback: number) => typeof config[key] === 'number' && Number.isFinite(config[key]) ? config[key] : fallback;
const color = (value: string, fallback: string) => { try { return Color3.FromHexString(value); } catch { return Color3.FromHexString(fallback); } };
const material = (scene: Scene, name: string, tint: Color3, opacity = 1, xray = false) => {
  const value = new StandardMaterial(`${name}-material`, scene); value.diffuseColor = tint.scale(.72); value.emissiveColor = tint.scale(xray ? .38 : .07);
  value.specularColor = new Color3(.32, .35, .38); value.alpha = opacity; value.backFaceCulling = false; value.disableDepthWrite = xray; return value;
};
const lineSystem = (scene: Scene, name: string, parent: TransformNode, lines: Vector3[][], tint: Color3) => {
  const mesh = MeshBuilder.CreateLineSystem(name, { lines }, scene); mesh.parent = parent; mesh.color = tint; mesh.isPickable = true; return mesh;
};
const circle = (plane: 'xy' | 'xz' | 'yz', radius: number, offset: Vector3, segments = 40) => Array.from({ length: segments + 1 }, (_, index) => {
  const angle = index / segments * Math.PI * 2; const a = Math.cos(angle) * radius; const b = Math.sin(angle) * radius;
  return plane === 'xy' ? new Vector3(a, b, 0).add(offset) : plane === 'xz' ? new Vector3(a, 0, b).add(offset) : new Vector3(0, a, b).add(offset);
});
const boxOutline = (scene: Scene, name: string, parent: TransformNode, tint: Color3) => {
  const p = (x: number, y: number, z: number) => new Vector3(x * .5, y * .5, z * .5);
  return lineSystem(scene, name, parent, [
    [p(-1,-1,-1),p(1,-1,-1)],[p(1,-1,-1),p(1,1,-1)],[p(1,1,-1),p(-1,1,-1)],[p(-1,1,-1),p(-1,-1,-1)],
    [p(-1,-1,1),p(1,-1,1)],[p(1,-1,1),p(1,1,1)],[p(1,1,1),p(-1,1,1)],[p(-1,1,1),p(-1,-1,1)],
    [p(-1,-1,-1),p(-1,-1,1)],[p(1,-1,-1),p(1,-1,1)],[p(1,1,-1),p(1,1,1)],[p(-1,1,-1),p(-1,1,1)],
  ], tint);
};
const shapeOutline = (scene: Scene, name: string, parent: TransformNode, shape: string, tint: Color3) => {
  if (shape === 'plane') return lineSystem(scene, name, parent, [[new Vector3(-.5,-.5,0),new Vector3(.5,-.5,0),new Vector3(.5,.5,0),new Vector3(-.5,.5,0),new Vector3(-.5,-.5,0)]], tint);
  if (shape === 'box') return boxOutline(scene, name, parent, tint);
  if (shape === 'sphere') return lineSystem(scene, name, parent, [circle('xy', .5, Vector3.Zero()), circle('xz', .5, Vector3.Zero()), circle('yz', .5, Vector3.Zero())], tint);
  const end = shape === 'capsule' ? .3 : .5;
  return lineSystem(scene, name, parent, [circle('xy', .5, new Vector3(0, 0, -end)), circle('xy', .5, new Vector3(0, 0, end)),
    [new Vector3(.5,0,-end),new Vector3(.5,0,end)],[new Vector3(-.5,0,-end),new Vector3(-.5,0,end)],
    [new Vector3(0,.5,-end),new Vector3(0,.5,end)],[new Vector3(0,-.5,-end),new Vector3(0,-.5,end)]], tint);
};
const createSurface = (scene: Scene, name: string, parent: TransformNode, shape: string, tint: Color3, opacity: number, mode: string) => {
  if (mode === 'hidden') return;
  const mesh = shape === 'plane' ? MeshBuilder.CreatePlane(name, { size: 1 }, scene)
    : shape === 'sphere' ? MeshBuilder.CreateSphere(name, { diameter: 1, segments: 24 }, scene)
    : shape === 'cylinder' ? MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1, tessellation: 32 }, scene)
    : shape === 'capsule' ? MeshBuilder.CreateCapsule(name, { height: 1, radius: .25, tessellation: 24 }, scene)
    : MeshBuilder.CreateBox(name, { size: 1 }, scene);
  mesh.parent = parent; mesh.isPickable = true; if (shape === 'cylinder' || shape === 'capsule') mesh.rotation.x = Math.PI / 2;
  const alpha = mode === 'outline' ? .025 : mode === 'xray' ? Math.min(opacity, .28) : opacity; mesh.material = material(scene, name, tint, alpha, mode !== 'solid');
  shapeOutline(scene, `${name}-outline`, parent, shape, tint);
};
const appearanceConfig = (tint: string, mode = 'solid', opacity = 1) => ({ color: tint, displayMode: mode, opacity });
const primitive = (typeId: string, label: string, shape: string, tint: string): AnimationObjectFactory => ({
  typeId, label, category: '基础几何', layer: 'visual', icon: 'object', defaultConfig: appearanceConfig(tint), properties: APPEARANCE_PROPERTIES,
  create: (scene, name, config) => { const node = root(scene, name); createSurface(scene, `${name}-shape`, node, shape, color(configString(config, 'color', tint), tint), configNumber(config, 'opacity', 1), configString(config, 'displayMode', 'solid')); return node; },
});
const volume = (typeId: string, label: string, tint: string): AnimationObjectFactory => ({
  typeId, label, category: '语义体积', layer: 'semantic', icon: 'volume', defaultConfig: { shape: 'box', ...appearanceConfig(tint, 'xray', .2) }, properties: VOLUME_PROPERTIES,
  create: (scene, name, config) => { const node = root(scene, name); createSurface(scene, `${name}-volume`, node, configString(config, 'shape', 'box'), color(configString(config, 'color', tint), tint), configNumber(config, 'opacity', .2), configString(config, 'displayMode', 'xray')); return node; },
});
const attach = (mesh: AbstractMesh, parent: TransformNode, mat: StandardMaterial) => { mesh.parent = parent; mesh.material = mat; mesh.isPickable = true; return mesh; };
const createSword = (scene: Scene, name: string, config: Readonly<Record<string, unknown>>) => {
  const node = root(scene, name); const tint = color(configString(config, 'color', '#7fa9bc'), '#7fa9bc'); const steel = material(scene, `${name}-steel`, tint); const dark = material(scene, `${name}-grip`, new Color3(.12,.13,.15)); const brass = material(scene, `${name}-guard`, new Color3(.67,.48,.2));
  const blade = attach(MeshBuilder.CreateBox(`${name}-blade`, { width: .11, height: .025, depth: 1.15 }, scene), node, steel); blade.position.z = .48;
  const tip = attach(MeshBuilder.CreateCylinder(`${name}-tip`, { height: .16, diameterTop: 0, diameterBottom: .11, tessellation: 4 }, scene), node, steel); tip.rotation.x = Math.PI / 2; tip.rotation.z = Math.PI / 4; tip.position.z = 1.135;
  const guard = attach(MeshBuilder.CreateBox(`${name}-guard`, { width: .42, height: .07, depth: .08 }, scene), node, brass); guard.position.z = -.13;
  const grip = attach(MeshBuilder.CreateCylinder(`${name}-grip`, { height: .34, diameter: .09, tessellation: 16 }, scene), node, dark); grip.rotation.x = Math.PI / 2; grip.position.z = -.34;
  const pommel = attach(MeshBuilder.CreateSphere(`${name}-pommel`, { diameter: .13, segments: 12 }, scene), node, brass); pommel.position.z = -.54; return node;
};
const createGun = (scene: Scene, name: string, config: Readonly<Record<string, unknown>>) => {
  const node = root(scene, name); const tint = color(configString(config, 'color', '#6f8793'), '#6f8793'); const metal = material(scene, `${name}-metal`, tint); const dark = material(scene, `${name}-dark`, new Color3(.10,.11,.12));
  const slide = attach(MeshBuilder.CreateBox(`${name}-slide`, { width: .19, height: .15, depth: .68 }, scene), node, metal); slide.position.set(0,.08,.18);
  const barrel = attach(MeshBuilder.CreateCylinder(`${name}-barrel`, { height: .54, diameter: .09, tessellation: 20 }, scene), node, dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0,.08,.36);
  const grip = attach(MeshBuilder.CreateBox(`${name}-grip`, { width: .16, height: .42, depth: .18 }, scene), node, dark); grip.position.set(0,-.18,-.02); grip.rotation.x = -.25;
  const trigger = attach(MeshBuilder.CreateTorus(`${name}-trigger-guard`, { diameter: .16, thickness: .025, tessellation: 16 }, scene), node, metal); trigger.rotation.x = Math.PI / 2; trigger.position.set(0,-.07,.05); return node;
};
const createStaff = (scene: Scene, name: string, config: Readonly<Record<string, unknown>>) => {
  const node = root(scene, name); const tint = color(configString(config, 'color', '#80684b'), '#80684b'); const wood = material(scene, `${name}-wood`, tint); const glow = material(scene, `${name}-focus`, new Color3(.32,.65,.92), 1);
  const shaft = attach(MeshBuilder.CreateCylinder(`${name}-shaft`, { height: 1.55, diameter: .075, tessellation: 18 }, scene), node, wood); shaft.rotation.x = Math.PI / 2; shaft.position.z = .3;
  const ring = attach(MeshBuilder.CreateTorus(`${name}-ring`, { diameter: .3, thickness: .035, tessellation: 24 }, scene), node, wood); ring.position.z = 1.12;
  const focus = attach(MeshBuilder.CreateSphere(`${name}-focus`, { diameter: .16, segments: 16 }, scene), node, glow); focus.position.z = 1.12; return node;
};
const createGauntlet = (scene: Scene, name: string, config: Readonly<Record<string, unknown>>) => {
  const node = root(scene, name); const tint = color(configString(config, 'color', '#8d6c48'), '#8d6c48'); const armor = material(scene, `${name}-armor`, tint); const dark = material(scene, `${name}-joint`, new Color3(.13,.12,.11));
  const palm = attach(MeshBuilder.CreateBox(`${name}-palm`, { width: .3, height: .16, depth: .34 }, scene), node, armor); palm.position.z = .08;
  for (let index = 0; index < 4; index += 1) { const finger = attach(MeshBuilder.CreateCapsule(`${name}-finger-${index}`, { height: .26, radius: .035, tessellation: 12 }, scene), node, index % 2 ? armor : dark); finger.rotation.x = Math.PI / 2; finger.position.set((index - 1.5) * .07, .015, .34); }
  const cuff = attach(MeshBuilder.CreateCylinder(`${name}-cuff`, { height: .2, diameterTop: .28, diameterBottom: .36, tessellation: 16 }, scene), node, armor); cuff.rotation.x = Math.PI / 2; cuff.position.z = -.2; return node;
};
const blockout = (typeId: string, label: string, create: typeof createSword, tint: string): AnimationObjectFactory => ({
  typeId, label, category: '武器占位体', layer: 'visual', icon: 'weapon', defaultConfig: appearanceConfig(tint), properties: APPEARANCE_PROPERTIES,
  create: (scene, name, config) => { const node = create(scene, name, config); const mode = configString(config, 'displayMode', 'solid'); const opacity = configNumber(config, 'opacity', 1); node.getChildMeshes(false).forEach(mesh => { mesh.setEnabled(mode !== 'hidden'); const mat = mesh.material as StandardMaterial | null; if (mat) { mat.alpha = mode === 'solid' ? opacity : Math.min(opacity, mode === 'outline' ? .08 : .28); mat.disableDepthWrite = mode !== 'solid'; } }); return node; },
});

const factories: AnimationObjectFactory[] = [
  { typeId: 'core.empty', label: '空节点', category: '结构', layer: 'helper', icon: 'empty', defaultConfig: {}, properties: [], create: root },
  { typeId: 'core.socket', label: 'Socket 挂点', category: '结构', layer: 'helper', icon: 'socket', defaultConfig: {}, properties: [], create: (scene, name) => { const node = root(scene, name); lineSystem(scene, `${name}-axes`, node, [[Vector3.Zero(),new Vector3(.28,0,0)],[Vector3.Zero(),new Vector3(0,.28,0)],[Vector3.Zero(),new Vector3(0,0,.28)]], new Color3(.72,.78,.82)); const marker = MeshBuilder.CreatePolyhedron(`${name}-marker`, { type: 1, size: .09 }, scene); marker.parent = node; marker.material = material(scene, name, new Color3(.72,.78,.82), .15, true); return node; } },
  { typeId: 'rig.first-person', label: '第一人称 Rig', category: 'Rig', layer: 'helper', icon: 'socket', defaultConfig: { depth: .65 }, properties: [{ key: 'depth', label: '视锥深度', type: 'number', min: .1, max: 4, step: .05 }], create: (scene, name, config) => { const node = root(scene, name); const depth = configNumber(config, 'depth', .65); const width = depth * .58; const height = depth * .34; const origin = Vector3.Zero(); const corners = [new Vector3(-width,-height,depth),new Vector3(width,-height,depth),new Vector3(width,height,depth),new Vector3(-width,height,depth)]; lineSystem(scene, `${name}-frustum`, node, [[origin,corners[0]],[origin,corners[1]],[origin,corners[2]],[origin,corners[3]],[...corners,corners[0]]], new Color3(.5,.65,.73)); return node; } },
  { typeId: 'asset.model', label: 'GLB / GLTF 模型', category: '资源', layer: 'visual', icon: 'model', defaultConfig: { path: '' }, properties: [{ key: 'path', label: '模型资源', type: 'asset' }], previewSignature: () => 'asset-model-root-v1', create: (scene, name) => { const node = root(scene, name); boxOutline(scene, `${name}-placeholder`, node, new Color3(.35,.42,.46)); return node; } },
  primitive('babylon.box', '立方体', 'box', '#38a8d4'), primitive('babylon.sphere', '球体', 'sphere', '#896bd2'), primitive('babylon.cylinder', '圆柱体', 'cylinder', '#56b982'), primitive('babylon.plane', '平面', 'plane', '#d58c3d'),
  blockout('blockout.sword', '剑 / 刀占位体', createSword, '#86aebf'), blockout('blockout.gun', '枪械占位体', createGun, '#718995'), blockout('blockout.staff', '法杖占位体', createStaff, '#80684b'), blockout('blockout.gauntlet', '拳套占位体', createGauntlet, '#8d6c48'),
  volume('semantic.proxy', '代理体', '#35b9d1'), volume('semantic.grip', '持握体', '#e7a13e'), volume('semantic.attack', '攻击体', '#e05261'),
  { typeId: 'semantic.muzzle', label: '发射端', category: '语义标记', layer: 'semantic', icon: 'socket', defaultConfig: { color: '#e95bb5' }, properties: [{ key: 'color', label: '颜色', type: 'color' }], create: (scene, name, config) => { const node = root(scene, name); const tint = color(configString(config, 'color', '#e95bb5'), '#e95bb5'); const dot = MeshBuilder.CreateSphere(`${name}-origin`, { diameter: .07, segments: 12 }, scene); dot.parent = node; dot.material = material(scene, name, tint); const cone = MeshBuilder.CreateCylinder(`${name}-direction`, { height: .18, diameterTop: 0, diameterBottom: .1, tessellation: 16 }, scene); cone.parent = node; cone.rotation.x = Math.PI / 2; cone.position.z = .25; cone.material = dot.material; lineSystem(scene, `${name}-ray`, node, [[Vector3.Zero(),new Vector3(0,0,.48)]], tint); return node; } },
  { typeId: 'debug.aim-ray', label: '方向射线', category: '辅助显示', layer: 'helper', icon: 'socket', defaultConfig: { color: '#72aee6', length: 1 }, properties: [{ key: 'color', label: '颜色', type: 'color' }, { key: 'length', label: '长度', type: 'number', min: .05, max: 20, step: .05 }], create: (scene, name, config) => { const node = root(scene, name); const length = configNumber(config, 'length', 1); lineSystem(scene, name, node, [[Vector3.Zero(),new Vector3(0,0,length)],[new Vector3(0,0,length),new Vector3(-.05,0,length-.12)],[new Vector3(0,0,length),new Vector3(.05,0,length-.12)]], color(configString(config, 'color', '#72aee6'), '#72aee6')); return node; } },
];

export const animationObjectFactories = Object.freeze(factories);
export const animationObjectFactoryById = new Map(factories.map(factory => [factory.typeId, factory]));
