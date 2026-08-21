/** @deprecated 独立 Ash Lab 的兼容入口；正式死亡效果由 effects/sprite-death 管理。 */
export {
  createSpriteDeathParticles as createSpriteDissolveParticles,
  type SpriteDeathParticleController as SpriteDissolveParticleController
} from '@/core/effects/sprite-death/particles/createSpriteDeathParticles.ts';
