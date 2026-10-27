import type { Scene, Mesh } from '@babylonjs/core';
import { createSpriteDeathParticles, type SpriteDeathParticleController } from '@/core/effects/sprite-death/particles/createSpriteDeathParticles';
import { applyMonsterDissolve, type MonsterDissolvePreset } from '@/core/monster/dissolve/monsterDissolve';
import type { SpriteAshPreset } from '@/core/sprite/ash/spriteAsh.types';
import type { MonsterVisualObjectsService, MonsterVisualObjectTarget } from '../monster-visual-objects/monsterVisualObjects.service';

export const MONSTER_DISSOLVE_LAYERS = ['body', 'line'] as const;
type Playback = { target: MonsterVisualObjectTarget; revision: number; preset: MonsterDissolvePreset; progress: number; playing: boolean; time: number; particles: SpriteDeathParticleController | null };
type ParticleFactory = (scene: Scene, mesh: Mesh, preset: SpriteAshPreset) => SpriteDeathParticleController;
/** Preview state is transient; only the two character layers receive effect parameters. */
export class MonsterDissolvePreview {
  private active = new Map<string, Playback>();
  private scene: Scene;
  private objects: MonsterVisualObjectsService;
  private particles: ParticleFactory;
  constructor(scene: Scene, objects: MonsterVisualObjectsService, particles: ParticleFactory = createSpriteDeathParticles) {
    this.scene = scene; this.objects = objects; this.particles = particles;
  }
  status(id: string) { const active = this.active.get(id); return active ? { progress: active.progress, playing: active.playing, presetName: active.preset.name } : null; }
  play(id: string, preset: MonsterDissolvePreset, progress = 0, playing = true) {
    const target = this.objects.target(id);
    if (!target || target.root.isDisposed() || !target.root.isEnabled()) throw new Error('请先选中一个可见的怪物视觉对象。');
    const mesh = target.getLayerMesh('body') ?? target.getLayerMesh('line');
    if (!mesh) throw new Error('选中的怪物没有身体或线稿精灵。');
    this.reset(id);
    const copy = structuredClone(preset);
    const particles = copy.particleMode === 'none' ? null : this.particles(this.scene, mesh, copy);
    particles?.setDisplayScale(2.8);
    const active: Playback = { target, revision: target.revision, preset: copy, progress: 0, playing, time: 0, particles };
    this.active.set(id, active);
    this.apply(active, progress); this.objects.refresh();
  }
  scrub(id: string, preset: MonsterDissolvePreset, progress: number) {
    const active = this.active.get(id);
    if (!active || active.preset.presetKey !== preset.presetKey) this.play(id, preset, progress, false);
    else { active.playing = false; this.apply(active, progress); }
  }
  private apply(active: Playback, progress: number) {
    active.progress = Math.max(0, Math.min(1, progress));
    applyMonsterDissolve(active.target, active.preset, active.progress);
    active.particles?.setProgress(active.progress);
    if (active.progress >= 1) active.playing = false;
  }
  prune() {
    for (const [id, active] of this.active) {
      const current = this.objects.target(id);
      if (!current || current.root !== active.target.root || current.root.isDisposed() || current.revision !== active.revision) this.reset(id);
    }
  }
  update(dt: number) {
    this.prune();
    for (const active of this.active.values()) {
      active.time += Math.max(0, dt);
      if (active.playing) this.apply(active, active.progress + Math.max(0, dt) / Math.max(.1, active.preset.duration));
      active.particles?.updateTime(active.time);
    }
  }
  setPaused(paused: boolean) { for (const active of this.active.values()) active.particles?.setPaused(paused); }
  reset(id: string) {
    const active = this.active.get(id); if (!active) return;
    this.active.delete(id); active.particles?.dispose();
    applyMonsterDissolve(active.target, active.preset, 0, false);
    this.objects.refresh();
  }
  resetAll() { for (const id of [...this.active.keys()]) this.reset(id); }
  dispose() { this.resetAll(); }
}
