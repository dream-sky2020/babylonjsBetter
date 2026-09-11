import { mixNumericContributions, type NumericContributionMix, type NumericContribution } from '../contribution/index.ts';
import { createCoreSignalNodeRegistry, evaluateSignalGraph, type SignalGraphEvaluation } from '../signal/index.ts';
import type { AnimationEventMarker, AnimationSceneObject, AnimationScenePreset, AnimationSignalBinding } from './animationScenePreset.ts';

export type AnimationSceneFrame = Readonly<{ evaluation: SignalGraphEvaluation; mix: NumericContributionMix }>;
export type AnimationScenePlayerCallbacks = Readonly<{
  applyNumber?(objectId: string, path: string, value: number): void;
  emitEvent?(event: AnimationEventMarker): void;
}>;

const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const transformBaseValue = (object: AnimationSceneObject, binding: AnimationSignalBinding) => {
  if (binding.adapterTypeId !== 'babylon.transform-component.number') return undefined;
  const [group, axis] = String(binding.config.path ?? '').split('.') as ['position' | 'rotation' | 'scaling', 'x' | 'y' | 'z'];
  return object[group]?.[axis];
};

export const animationTargetKey = (objectId: string, path: string) => `${objectId}:${path}`;

export function evaluateAnimationScenePreset(preset: AnimationScenePreset, time: number, deltaTime = 0): AnimationSceneFrame {
  const evaluation = evaluateSignalGraph(preset.signalGraph, createCoreSignalNodeRegistry(), time, deltaTime);
  const objects = new Map(preset.objects.map(object => [object.id, object]));
  const baseValues = new Map<string, number>();
  const contributions: NumericContribution[] = [];
  preset.bindings.forEach(binding => {
    const object = objects.get(binding.objectId); if (!object) return;
    const baseValue = transformBaseValue(object, binding); if (baseValue === undefined) return;
    const path = String(binding.config.path ?? ''); const targetKey = animationTargetKey(binding.objectId, path);
    const rawValue = evaluation.outputs.get(binding.outputId); if (typeof rawValue !== 'number') return;
    const modulationId = typeof binding.config.modulationOutputId === 'string' ? binding.config.modulationOutputId : '';
    const modulation = modulationId ? evaluation.outputs.get(modulationId) : 1;
    baseValues.set(targetKey, baseValue);
    contributions.push({
      id: binding.id, sourceId: binding.outputId, targetKey,
      value: rawValue * finite(binding.config.scale, 1) + finite(binding.config.offset, 0),
      weight: finite(binding.config.weight, 1) * (typeof modulation === 'number' ? modulation : 0),
      priority: finite(binding.config.priority, 0),
      blendMode: binding.config.operation === 'override' || binding.config.operation === 'multiply' ? binding.config.operation : 'additive',
      enabled: binding.config.enabled !== false, solo: binding.config.solo === true,
    });
  });
  return { evaluation, mix: mixNumericContributions(baseValues, contributions) };
}

/** Clock/event wrapper usable by a game loop; rendering and object ownership stay with the caller. */
export class AnimationScenePlayer {
  private currentTime = 0;
  private playing = false;
  readonly preset: AnimationScenePreset;
  private readonly callbacks: AnimationScenePlayerCallbacks;
  constructor(preset: AnimationScenePreset, callbacks: AnimationScenePlayerCallbacks = {}) { this.preset = preset; this.callbacks = callbacks; }
  get time() { return this.currentTime; }
  get isPlaying() { return this.playing; }
  play(restart = false) { if (restart) this.currentTime = 0; this.playing = true; this.apply(0); }
  pause() { this.playing = false; }
  stop() { this.playing = false; this.currentTime = 0; this.apply(0); }
  seek(time: number) { this.currentTime = Math.min(this.preset.transport.duration, Math.max(0, time)); this.apply(0); }
  update(deltaTime: number) {
    if (!this.playing || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
    const duration = this.preset.transport.duration;
    const previous = this.currentTime;
    const next = previous + deltaTime * this.preset.transport.playbackSpeed;
    if (next <= duration) {
      this.currentTime = next; this.emitBetween(previous, next); this.apply(deltaTime); return;
    }
    this.emitBetween(previous, duration);
    if (this.preset.transport.loop) {
      this.currentTime = next % duration; this.emitBetween(-Number.EPSILON, this.currentTime); this.apply(deltaTime); return;
    }
    this.currentTime = duration; this.playing = false; this.apply(deltaTime);
  }
  getMountPoint(id: string) { return this.preset.mountPoints.find(mount => mount.id === id); }
  private emitBetween(from: number, to: number) { this.preset.events.forEach(event => { if (event.time > from && event.time <= to) this.callbacks.emitEvent?.(event); }); }
  private apply(deltaTime: number) {
    const frame = evaluateAnimationScenePreset(this.preset, this.currentTime, deltaTime);
    frame.mix.values.forEach((value, key) => {
      const separator = key.indexOf(':'); if (separator < 0) return;
      this.callbacks.applyNumber?.(key.slice(0, separator), key.slice(separator + 1), value);
    });
  }
}
