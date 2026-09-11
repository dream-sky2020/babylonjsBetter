import type { AnimationProject, WeaponHand, WeaponTrack } from '../../model/preset/firstPersonWeaponPreset.ts';
import type { SignalGraphConnection, SignalGraphNode, SignalGraphOutput } from '../signal/index.ts';
import type { AnimationEventMarker, AnimationSceneObject, AnimationScenePreset, AnimationSignalBinding, AnimationVec3 } from './animationScenePreset.ts';

const vec = (x = 0, y = 0, z = 0): AnimationVec3 => ({ x, y, z });
const object = (id: string, parentId: string | null, name: string, factoryTypeId: string, enabled: boolean, position = vec(), rotation = vec(), scaling = vec(1, 1, 1), config: Readonly<Record<string, unknown>> = {}): AnimationSceneObject => ({ id, parentId, name, factoryTypeId, enabled, position, rotation, scaling, config });

const semanticObjects = (hand: WeaponHand, track: WeaponTrack, poseId: string): AnimationSceneObject[] => {
  const prefix = `${hand}-weapon`;
  const proxy = track.proxy;
  return [
    object(`${prefix}-model-mount`, poseId, hand === 'right' ? '右手模型挂载点' : '左手模型挂载点', 'core.socket', track.enabled, track.asset.offset, track.asset.rotation, vec(track.asset.scale, track.asset.scale, track.asset.scale)),
    object(`${prefix}-proxy`, poseId, '武器代理体', 'semantic.proxy', track.enabled, proxy.center, proxy.rotation, proxy.size, { shape: proxy.shape, color: '#35b9d1', displayMode: 'xray', opacity: .14 }),
    object(`${prefix}-grip`, poseId, '持握体', 'semantic.grip', track.enabled && proxy.gripVolume.enabled, proxy.gripVolume.center, proxy.gripVolume.rotation, proxy.gripVolume.size, { shape: proxy.gripVolume.shape, color: '#e7a13e', displayMode: 'xray', opacity: .2 }),
    object(`${prefix}-attack`, poseId, '攻击体', 'semantic.attack', track.enabled && proxy.attackVolume.enabled, proxy.attackVolume.center, proxy.attackVolume.rotation, proxy.attackVolume.size, { shape: proxy.attackVolume.shape, color: '#e05261', displayMode: 'xray', opacity: .18 }),
    object(`${prefix}-muzzle`, poseId, '发射端', 'semantic.muzzle', track.enabled && proxy.muzzle.enabled, proxy.muzzle.position, proxy.muzzle.rotation, vec(1, 1, 1), { color: '#e95bb5' }),
  ];
};

const COMPONENTS = ['position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z'] as const;

/** Converts the legacy fixed weapon tracks into ordinary signals, bindings and objects. */
export function migrateFirstPersonWeaponPreset(project: AnimationProject, key = 'migrated-action'): AnimationScenePreset {
  const nodes: SignalGraphNode[] = [{ id: 'time', typeId: 'core.time', version: 1, label: 'Time', position: { x: 32, y: 48 }, config: {} }];
  const connections: SignalGraphConnection[] = [];
  const outputs: SignalGraphOutput[] = [];
  const bindings: AnimationSignalBinding[] = [];
  const events: AnimationEventMarker[] = [];
  const objects: AnimationSceneObject[] = [
    object('animation-root', null, '动画根节点', 'core.empty', true),
    object('first-person-rig', 'animation-root', '第一人称 Rig', 'rig.first-person', true, vec(), vec(), vec(1, 1, 1), { depth: .65 }),
  ];
  const mountPoints: AnimationScenePreset['mountPoints'][number][] = [];

  (['right', 'left'] as const).forEach((hand, handIndex) => {
    const track = project.weapons[hand];
    const poseId = `${hand}-weapon-pose`;
    objects.push(object(poseId, 'first-person-rig', hand === 'right' ? '右手动作节点' : '左手动作节点', 'core.empty', track.enabled));
    objects.push(...semanticObjects(hand, track, poseId));
    if (track.enabled) mountPoints.push({ id: `${hand}-item`, name: hand === 'right' ? '右手道具' : '左手道具', objectId: `${hand}-weapon-model-mount`, role: 'item', tags: ['first-person', hand] });
    if (!track.enabled) return;
    COMPONENTS.forEach((path, componentIndex) => {
      const [group, axis] = path.split('.') as ['position' | 'rotation', 'x' | 'y' | 'z'];
      const nodeId = `${hand}-${group}-${axis}-curve`;
      const outputId = `${hand}-${group}-${axis}`;
      nodes.push({ id: nodeId, typeId: 'core.curve.number', version: 1, label: `${hand === 'right' ? 'Right' : 'Left'} ${group}.${axis}`, position: { x: 260 + handIndex * 230, y: 24 + componentIndex * 118 }, config: { interpolation: 'smoothstep', keys: track.keyframes.map(frame => ({ id: `${hand}-${group}-${axis}-${frame.id}`, time: frame.time, value: frame[group][axis] })) } });
      connections.push({ id: `time-to-${nodeId}`, source: { nodeId: 'time', portId: 'time' }, target: { nodeId, portId: 'time' } });
      outputs.push({ id: outputId, name: `${hand} ${path}`, valueTypeId: 'core.number', source: { nodeId, portId: 'value' } });
      bindings.push({ id: `bind-${outputId}`, outputId, objectId: poseId, adapterTypeId: 'babylon.transform-component.number', config: { path, operation: 'override', weight: 1, priority: 0, scale: 1, offset: 0, enabled: true, solo: false } });
    });
    track.keyframes.forEach(frame => events.push({ id: `${hand}-${frame.id}`, time: frame.time, typeId: 'animation.marker', config: { label: frame.label, hand, sourceKeyframeId: frame.id } }));
  });

  return {
    version: 1,
    name: project.name,
    description: `从 model-shake-lab 迁移：${project.name}`,
    tags: ['first-person', 'migrated', key],
    objects,
    mountPoints,
    events: events.sort((left, right) => left.time - right.time),
    signalGraph: { version: 1, nodes, connections, parameters: [], outputs },
    bindings,
    transport: { duration: project.duration, loop: project.loop, playbackSpeed: project.playbackSpeed },
  };
}
