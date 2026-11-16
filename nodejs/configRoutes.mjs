import { join } from 'node:path'
import { failure, json, readRequestJson, RequestError } from './http.mjs'
import { fileExists, readJson, rejectLink, slashes, writeAtomic } from './storage.mjs'
import { isRecord, sizeOf } from './validation/jsonValues.mjs'
import * as presets from './validation/presets.mjs'
import { validateAnimationScenePresets } from './validation/animationScenePresets.mjs'
import { validateCurrentExclamationBases, validateCurrentExclamationMarks } from './validation/editorPresets.mjs'
import { validateWeaponPresets } from './validation/weaponPresets.mjs'

const objectRequired = 'body must be a JSON object'
const rootRequired = 'config root must be an object'
const legacy = {
  invalidRoot: '配置文件根节点必须是 JSON 对象',
  invalidBody: 'body must be a json object',
  legacyMessages: true,
  errorCount: true,
}
const legacyModel = { invalidRoot: rootRequired, invalidBody: objectRequired, errorCount: true }
const countObject = value => isRecord(value) ? Object.keys(value).length : 0
const definitions = [
  ['model-scene-presets', 'modelScenePresets', presets.validateModelScenePresetPayload, 'scene presets', { ...legacyModel, invalidMessage: 'scene preset validation failed' }],
  ['model-asset-profiles', 'modelAssetProfiles', presets.validateModelAssetProfilePayload, 'model asset profiles', { errorCount: true, invalidMessage: 'model asset profile validation failed' }],
  ['model-shake-presets', 'modelShakePresets', presets.validateModelShakePresetPayload, 'shake presets', { ...legacyModel, invalidMessage: 'shake preset validation failed' }],
  ['first-person-weapon-presets', 'firstPersonWeaponPresets', validateWeaponPresets, 'first-person weapon presets', { ...legacyModel, invalidMessage: 'first-person weapon preset validation failed' }],
  ['animation-scene-presets', 'animationScenePresets', validateAnimationScenePresets],
  ['model-display-configs', 'modelDisplayConfigs', presets.validateModelDisplayConfigPayload, 'model display configs', { errorCount: true, invalidMessage: 'model display config validation failed' }],
  ['model-swing-configs', 'modelSwingConfigs', presets.validateModelSwingConfigPayload, 'model swing configs', { errorCount: true, invalidMessage: 'model swing config validation failed' }],
  ['model-shoot-configs', 'modelShootConfigs', presets.validateModelShootConfigPayload],
  ['bullet-configs', 'bulletConfigs', presets.validateBulletConfigPayload],
  ['avatar-configs', 'avatarConfigs', presets.validateAvatarConfigPayload],
  ['exclamation-mark-presets', 'exclamationMarkPresets', validateCurrentExclamationMarks],
  ['exclamation-base-presets', 'exclamationBasePresets', validateCurrentExclamationBases],
  ['monster-exclamation-positions', 'monsterExclamationPositions', presets.validateMonsterExclamationPositionPayload],
  ['monster-battlefield-formations', 'monsterBattlefieldFormations', presets.validateMonsterBattlefieldFormationPayload],
  ['monster-battlefield-stripe-rules', 'monsterBattlefieldStripeRules', presets.validateMonsterBattlefieldStripeRulePayload],
  ['monster-movement-configs', 'monsterMovementConfigs', presets.validateMonsterMovementConfigPayload],
  ['monster-attack-configs', 'monsterAttackConfigs', presets.validateMonsterAttackConfigPayload],
  ['monster-death-configs', 'monsterDeathConfigs', presets.validateMonsterDeathConfigPayload],
  ['sprite-ash-presets', 'spriteAshPresets', presets.validateSpriteAshPresetPayload],
  ['monster-dissolve-presets', 'monsterDissolvePresets', presets.validateSpriteAshPresetPayload],
  ['monster-status-particle-configs', 'monsterStatusParticleConfigs', presets.validateMonsterStatusParticleConfigPayload],
  ['special-status-visual-presets', 'specialStatusVisualPresets', presets.validateSpecialStatusVisualPresetPayload],
  ['monster-special-status-positions', 'monsterSpecialStatusPositions', presets.validateMonsterSpecialStatusPositionPayload],
  ['sprite-anchor-presets', 'spriteAnchorPresets', presets.validateSpriteAnchorPayload, undefined, legacy],
  ['sprite-animation-library', 'spriteAnimationLibrary', presets.validateSpriteAnimationPayload, undefined, {
    ...legacy,
    defaultData: { rigs: {}, clips: {} },
    count: data => countObject(data.rigs) + countObject(data.clips),
    omitWriteCount: true,
  }],
  ['number-sprite-configs', 'numberSpriteConfigs', presets.validateNumberSpriteConfigPayload, undefined, {
    invalidBody: legacy.invalidBody, legacyMessages: true, count: countObject,
  }],
  ['particle-effects', 'particleEffects', presets.validateParticleEffectPayload],
  ['particle-presets', 'particlePresets', presets.validateParticlePresetPayload],
  ['particle-visual-presets', 'particleVisualPresets', presets.validateParticleVisualPresetPayload],
  ['stripe-presets', 'stripePresets', presets.validateStripePresetPayload, undefined, legacy],
  ['monster-display-configs', 'monsterDisplayConfigs', presets.validateMonsterDisplayPayload, undefined, legacy],
  ['monster-stripe-presets', 'monsterStripePresets', presets.validateMonsterStripePresetPayload, undefined, legacy],
  ['pop-number-presets', 'popNumberPresets', presets.validatePopNumberPresetPayload, undefined, legacy],
  ['burst-capsule-presets', 'burstCapsulePresets', presets.validateBurstCapsulePresetPayload, undefined, legacy],
]

function configHandler(path, validate, label, options, serial) {
  const { invalidRoot, invalidBody, legacyMessages, errorCount, defaultData = {},
    count = sizeOf, omitWriteCount, invalidMessage = label + ' validation failed' } = options

  return async (request, { method }) => {
    try {
      await rejectLink(path)
      if (method === 'GET') {
        if (!await fileExists(path)) return json({ success: true, count: 0, data: defaultData })
        const data = await readJson(path)
        if (invalidRoot && !isRecord(data)) {
          return failure(invalidRoot, 500, legacyMessages ? { valid: false } : undefined)
        }
        const errors = validate(data)
        return json({ success: true, count: count(data), data, valid: errors.length === 0, errors: errors.slice(0, 50) })
      }

      const payload = await readRequestJson(request)
      if (invalidBody && !isRecord(payload)) return failure(invalidBody, 400)
      const errors = validate(payload)
      if (errors.length) {
        return failure(legacyMessages ? '配置校验失败' : invalidMessage, 400, {
          ...(errorCount ? { errorCount: errors.length } : {}),
          errors: errors.slice(0, 50),
        })
      }

      await serial(path, () => writeAtomic(path, JSON.stringify(payload, null, 2)))
      return json({ success: true, ...(omitWriteCount ? {} : { count: sizeOf(payload) }), path: slashes(path) })
    } catch (error) {
      if (error instanceof RequestError) throw error
      const read = method === 'GET'
      const message = legacyMessages ? (read ? '读取配置失败' : '写入配置失败')
        : 'failed to ' + (read ? 'read ' : 'write ') + label
      return failure(message + ': ' + error.message, 500)
    }
  }
}

export function registerConfigRoutes(route, configDir, serial) {
  for (const [endpoint, filename, validate, label = endpoint.replaceAll('-', ' '), options = {}] of definitions) {
    route('/api/' + endpoint, ['GET', 'PUT'], configHandler(join(configDir, filename + '.json'), validate, label, options, serial))
  }

  route('/api/shadow-quality-presets', ['GET'], async () => {
    try {
      const target = join(configDir, 'shadowQualityPresets.json')
      await rejectLink(target)
      const data = await fileExists(target) ? await readJson(target) : {}
      if (!isRecord(data)) return failure('shadow quality preset root must be an object', 500)
      return json({ success: true, count: sizeOf(data), data })
    } catch (error) {
      return failure('failed to read shadow quality presets: ' + error.message, 500)
    }
  })
}

