import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import type { WeaponProxy } from '@/core/model/preset/firstPersonWeaponPreset.ts';

/** Debug geometry never owns or scales the model installation node. +Z forward, +Y up. */
export function createWeaponProxyDebug(scene: Scene, parent: TransformNode, proxy: WeaponProxy, bodyVisible: boolean, markersVisible: boolean, handLabel = '', tint = new Color3(.2, .8, .9)) {
  const root = new TransformNode('weapon-proxy-debug', scene); root.parent = parent;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, color: Color3, alpha = 1) => {
    const m = new StandardMaterial(name, scene); m.diffuseColor = color; m.emissiveColor = color; m.disableLighting = true; m.alpha = alpha; materials.push(m); return m;
  };
  const bodyMat = mat('proxy-translucent', tint, .22);
  const attach = (mesh: Mesh, material: StandardMaterial) => { mesh.parent = root; mesh.material = material; mesh.isPickable = false; return mesh; };
  if (bodyVisible) {
    const body = proxy.shape === 'sphere' ? MeshBuilder.CreateSphere('proxy-body', { diameter: 1 }, scene)
      : proxy.shape === 'cylinder' ? MeshBuilder.CreateCylinder('proxy-body', { height: 1, diameter: 1 }, scene)
      : proxy.shape === 'capsule' ? MeshBuilder.CreateCapsule('proxy-body', { height: 1, radius: .2 }, scene)
      : MeshBuilder.CreateBox('proxy-body', { size: 1 }, scene);
    attach(body, bodyMat);
    if (proxy.shape === 'cylinder' || proxy.shape === 'capsule') {
      body.rotation.x = Math.PI / 2; const diameter = proxy.shape === 'capsule' ? .4 : 1;
      body.scaling.set(proxy.size.x / diameter, proxy.size.z, proxy.size.y / diameter);
    } else body.scaling.set(proxy.size.x, proxy.size.y, proxy.size.z);
    body.position.set(proxy.center.x, proxy.center.y, proxy.center.z);
    body.enableEdgesRendering(); body.edgesColor = new Color4(tint.r, tint.g, tint.b, .8);
    if (proxy.shape === 'gun') {
      const handle = attach(MeshBuilder.CreateBox('proxy-gun-grip', { width: proxy.size.x * .8, height: proxy.size.y * 1.8, depth: proxy.size.z * .22 }, scene), bodyMat);
      handle.position.set(proxy.grip.x, proxy.grip.y, proxy.grip.z); handle.enableEdgesRendering(); handle.edgesColor = new Color4(tint.r, tint.g, tint.b, .8);
    }
  }
  const textures: DynamicTexture[] = [];
  const labels: Mesh[] = [];
  const marker = (name: string, point: Vector3, color: Color3) => {
    const m = mat(name, color);
    const anchor = attach(MeshBuilder.CreateSphere(name, { diameter: .035 }, scene), m); anchor.position.copyFrom(point);
    const label = attach(MeshBuilder.CreatePlane(`${name}-label`, { width: .36, height: .09 }, scene), mat(`${name}-label`, color));
    // The anchor owns the local point so billboard rotation cannot alter its world position.
    label.parent = anchor; label.position.set(.08, .06, 0); label.billboardMode = Mesh.BILLBOARDMODE_ALL;
    if (name === '握持点') label.position.set(.08, -.09, 0);
    labels.push(label);
    const texture = new DynamicTexture(name, { width: 512, height: 128 }, scene, false); textures.push(texture);
    texture.hasAlpha = true; texture.drawText(handLabel && name === '原点 O' ? `${handLabel} O` : name, null, 100, 'bold 80px sans-serif', 'white', 'transparent', true);
    (label.material as StandardMaterial).diffuseTexture = texture; (label.material as StandardMaterial).useAlphaFromDiffuseTexture = true;
  };
  if (markersVisible) {
    marker('原点 O', Vector3.Zero(), Color3.White());
    marker('握持点', new Vector3(proxy.grip.x, proxy.grip.y, proxy.grip.z), new Color3(1, .65, .1));
    marker(proxy.shape === 'gun' ? '枪口' : '攻击端', new Vector3(proxy.tip.x, proxy.tip.y, proxy.tip.z), new Color3(1, .25, .7));
    for (const [name, end, color] of [ ['前 +Z', new Vector3(0, 0, .45), new Color3(.2, .65, 1)], ['上 +Y', new Vector3(0, .4, 0), Color3.Green()], ['右 +X', new Vector3(.3, 0, 0), Color3.Red()] ] as const) {
      const side = name === '上 +Y' ? new Vector3(.035, 0, 0) : new Vector3(0, .035, 0);
      const back = end.scale(.85);
      const line = MeshBuilder.CreateLines(name, { points: [Vector3.Zero(), end, back.add(side), end, back.subtract(side)] }, scene); line.parent = root; line.color = color; marker(name, end, color);
    }
  }
  const observer = scene.onBeforeRenderObservable.add(() => {
    const camera = scene.activeCamera; if (!camera) return;
    for (const label of labels) {
      const distance = Vector3.Distance(camera.globalPosition, label.getAbsolutePosition());
      label.scaling.setAll(Math.max(.2, distance * 2 * Math.tan(camera.fov / 2) * 24 / scene.getEngine().getRenderHeight() / .09));
    }
  });
  return () => { scene.onBeforeRenderObservable.remove(observer); root.dispose(); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); };
}
