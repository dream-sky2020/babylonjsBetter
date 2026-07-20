import { Color3, type Scene } from '@babylonjs/core';
import {
  createCompositeSprite,
  type AtlasBundle,
  type CompositeSprite
} from '@/core/sprite/composition/createCompositeSprite.ts';
import {
  evaluateSpriteAnimClip
} from '@/core/sprite/animation/evaluateSpriteAnimClip.ts';
import {
  computeOnionSkinSamples,
  type OnionSkinSample,
  type OnionSkinSettings
} from '@/core/sprite/animation/onionSkinSamples.ts';
import type { SpriteAnimClip, SpriteRigDef } from '@/core/sprite/types/sprite-animation.types.ts';

const PAST_TINT = new Color3(1, 0.2, 0.22);
const FUTURE_TINT = new Color3(0.25, 0.45, 1);

export type OnionSkinController = {
  update: (clip: SpriteAnimClip, currentTime: number, settings: OnionSkinSettings) => void;
  rebuild: (rig: SpriteRigDef, atlases: AtlasBundle) => void;
  dispose: () => void;
};

type GhostSlot = {
  composite: CompositeSprite;
};

/**
 * 洋葱皮残影层：复用主预览的 atlas，额外创建半透明组合体。
 * 过去=红，未来=蓝；越远越透明。
 */
export const createOnionSkinController = (scene: Scene): OnionSkinController => {
  let slots: GhostSlot[] = [];
  let currentRig: SpriteRigDef | null = null;
  let currentAtlases: AtlasBundle | null = null;

  const disposeSlots = () => {
    for (const slot of slots) {
      slot.composite.dispose();
    }
    slots = [];
  };

  const ensureSlotCount = (count: number) => {
    if (!currentRig || !currentAtlases) return;
    while (slots.length < count) {
      const index = slots.length;
      const composite = createCompositeSprite(scene, currentRig, currentAtlases, {
        nameSuffix: `onion_${index}`,
        pickable: false,
        zBias: -0.8 - index * 0.03
      });
      slots.push({ composite });
    }
    while (slots.length > count) {
      const removed = slots.pop();
      removed?.composite.dispose();
    }
  };

  const applySample = (slot: GhostSlot, sample: OnionSkinSample, clip: SpriteAnimClip) => {
    const tint = sample.direction === 'past' ? PAST_TINT : FUTURE_TINT;
    slot.composite.root.setEnabled(true);
    slot.composite.setStyle(tint, sample.alpha);
    slot.composite.resetToBindPose();
    slot.composite.applyPoseMap(evaluateSpriteAnimClip(clip, sample.time));
  };

  return {
    rebuild: (rig, atlases) => {
      currentRig = rig;
      currentAtlases = atlases;
      disposeSlots();
    },
    update: (clip, currentTime, settings) => {
      if (!settings.enabled || !currentRig || !currentAtlases) {
        for (const slot of slots) {
          slot.composite.root.setEnabled(false);
        }
        return;
      }

      const samples = computeOnionSkinSamples(clip, currentTime, settings);
      ensureSlotCount(samples.length);

      for (let i = 0; i < slots.length; i += 1) {
        const sample = samples[i];
        if (!sample) {
          slots[i].composite.root.setEnabled(false);
          continue;
        }
        applySample(slots[i], sample, clip);
      }
    },
    dispose: () => {
      disposeSlots();
      currentRig = null;
      currentAtlases = null;
    }
  };
};
