import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import type { InteractionVolume, WeaponProxy } from '@/core/model/preset/firstPersonWeaponPreset.ts';

const radians = Math.PI / 180;

/** Debug geometry never owns or scales the model installation node. +Z forward, +Y up. */
export function createWeaponProxyDebug(scene: Scene, parent: TransformNode, proxy: WeaponProxy, bodyVisible: boolean, markersVisible: boolean, handLabel = '', tint = new Color3(.2, .8, .9)) {
  const root = new TransformNode('weapon-proxy-debug', scene); root.parent = parent;
  const materials: StandardMaterial[] = []; const textures: DynamicTexture[] = []; const labels: Mesh[] = [];
  const mat = (name: string, color: Color3, alpha = 1) => { const material = new StandardMaterial(name, scene); material.diffuseColor = color; material.emissiveColor = color; material.disableLighting = true; material.alpha = alpha; materials.push(material); return material; };
  const attach = (mesh: Mesh, material: StandardMaterial) => { mesh.parent = root; mesh.material = material; mesh.isPickable = false; return mesh; };
  const orient = (node: TransformNode | Mesh, rotation: { x: number; y: number; z: number }) => { node.rotationQuaternion = Quaternion.FromEulerAngles(rotation.x * radians, rotation.y * radians, rotation.z * radians); };
  const volumeMesh = (name: string, volume: InteractionVolume, color: Color3) => {
    if (!bodyVisible || !volume.enabled) return;
    const mesh = volume.shape === 'cylinder' ? MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1, tessellation: 32 }, scene)
      : volume.shape === 'capsule' ? MeshBuilder.CreateCapsule(name, { height: 1, radius: .2, tessellation: 32 }, scene)
      : volume.shape === 'sphere' ? MeshBuilder.CreateSphere(name, { diameter: 1, segments: 24 }, scene)
      : MeshBuilder.CreateBox(name, { size: 1 }, scene);
    attach(mesh, mat(`${name}-material`, color, volume.shape === 'box' ? .28 : .38));
    const isAxial = volume.shape === 'cylinder' || volume.shape === 'capsule';
    if (isAxial) { const diameter = volume.shape === 'capsule' ? .4 : 1; mesh.scaling.set(volume.size.x / diameter, volume.size.z, volume.size.y / diameter); }
    else mesh.scaling.set(volume.size.x, volume.size.y, volume.size.z);
    mesh.position.set(volume.center.x, volume.center.y, volume.center.z); orient(mesh, isAxial ? { ...volume.rotation, x: volume.rotation.x + 90 } : volume.rotation);
    if (volume.shape === 'box') { mesh.enableEdgesRendering(); mesh.edgesColor = new Color4(color.r, color.g, color.b, .95); mesh.edgesWidth = 2; }
  };
  const labelAt = (name: string, point: Vector3, color: Color3, dot = false) => {
    const anchor = new TransformNode(`${name}-anchor`, scene); anchor.parent = root; anchor.position.copyFrom(point);
    if (dot) { const pointMesh = attach(MeshBuilder.CreateSphere(name, { diameter: .038 }, scene), mat(name, color)); pointMesh.parent = anchor; }
    const label = attach(MeshBuilder.CreatePlane(`${name}-label`, { width: .48, height: .09 }, scene), mat(`${name}-label`, color)); label.parent = anchor; label.position.set(.1, .07, 0); label.billboardMode = Mesh.BILLBOARDMODE_ALL; labels.push(label);
    const texture = new DynamicTexture(name, { width: 640, height: 128 }, scene, false); textures.push(texture); texture.hasAlpha = true; texture.drawText(name, null, 96, 'bold 76px sans-serif', 'white', 'transparent', true);
    (label.material as StandardMaterial).diffuseTexture = texture; (label.material as StandardMaterial).useAlphaFromDiffuseTexture = true;
  };

  if (bodyVisible) {
    const body = proxy.shape === 'sphere' ? MeshBuilder.CreateSphere('proxy-body', { diameter: 1 }, scene)
      : proxy.shape === 'cylinder' ? MeshBuilder.CreateCylinder('proxy-body', { height: 1, diameter: 1 }, scene)
      : proxy.shape === 'capsule' ? MeshBuilder.CreateCapsule('proxy-body', { height: 1, radius: .2 }, scene)
      : MeshBuilder.CreateBox('proxy-body', { size: 1 }, scene);
    attach(body, mat('proxy-translucent', tint, .14));
    const isAxial = proxy.shape === 'cylinder' || proxy.shape === 'capsule';
    if (isAxial) { const diameter = proxy.shape === 'capsule' ? .4 : 1; body.scaling.set(proxy.size.x / diameter, proxy.size.z, proxy.size.y / diameter); }
    else body.scaling.set(proxy.size.x, proxy.size.y, proxy.size.z);
    body.position.set(proxy.center.x, proxy.center.y, proxy.center.z); orient(body, isAxial ? { ...proxy.rotation, x: proxy.rotation.x + 90 } : proxy.rotation); body.enableEdgesRendering(); body.edgesColor = new Color4(tint.r, tint.g, tint.b, .65);
    volumeMesh('grip-volume', proxy.gripVolume, new Color3(1, .58, .08));
    volumeMesh('attack-volume', proxy.attackVolume, new Color3(1, .16, .34));
  }

  if (markersVisible) {
    labelAt(handLabel ? `${handLabel} O` : '原点 O', Vector3.Zero(), Color3.White(), true);
    if (proxy.gripVolume.enabled) labelAt('持握体', new Vector3(proxy.gripVolume.center.x, proxy.gripVolume.center.y, proxy.gripVolume.center.z), new Color3(1, .58, .08));
    if (proxy.attackVolume.enabled) labelAt('攻击体', new Vector3(proxy.attackVolume.center.x, proxy.attackVolume.center.y, proxy.attackVolume.center.z), new Color3(1, .16, .34));
    if (proxy.muzzle.enabled) {
      const muzzleRoot = new TransformNode('muzzle-direction', scene); muzzleRoot.parent = root; muzzleRoot.position.set(proxy.muzzle.position.x, proxy.muzzle.position.y, proxy.muzzle.position.z); orient(muzzleRoot, proxy.muzzle.rotation);
      const color = new Color3(1, .25, .78); const line = MeshBuilder.CreateLines('muzzle-ray', { points: [Vector3.Zero(), new Vector3(0, 0, .32), new Vector3(-.035, 0, .25), new Vector3(0, 0, .32), new Vector3(.035, 0, .25)] }, scene); line.parent = muzzleRoot; line.color = color;
      labelAt('发射端', new Vector3(proxy.muzzle.position.x, proxy.muzzle.position.y, proxy.muzzle.position.z), color, true);
    }
    for (const [name, end, color] of [['前 +Z', new Vector3(0, 0, .45), new Color3(.2, .65, 1)], ['上 +Y', new Vector3(0, .4, 0), Color3.Green()], ['右 +X', new Vector3(.3, 0, 0), Color3.Red()]] as const) {
      const side = name === '上 +Y' ? new Vector3(.035, 0, 0) : new Vector3(0, .035, 0); const back = end.scale(.85);
      const line = MeshBuilder.CreateLines(name, { points: [Vector3.Zero(), end, back.add(side), end, back.subtract(side)] }, scene); line.parent = root; line.color = color; labelAt(name, end, color);
    }
  }
  const observer = scene.onBeforeRenderObservable.add(() => { const camera = scene.activeCamera; if (!camera) return; for (const label of labels) { const distance = Vector3.Distance(camera.globalPosition, label.getAbsolutePosition()); label.scaling.setAll(Math.max(.2, distance * 2 * Math.tan(camera.fov / 2) * 24 / scene.getEngine().getRenderHeight() / .09)); } });
  return () => { scene.onBeforeRenderObservable.remove(observer); root.dispose(); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose()); };
}
