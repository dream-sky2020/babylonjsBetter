import { realpath } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readJson, rejectLink } from './storage.mjs'
import { isRecord } from './validation/jsonValues.mjs'
import { validateModelMaterialBindings } from './validation/modelMaterialBindings.mjs'

export async function readSceneEnvironmentPresets(directory) {
  const root = await realpath(directory)
  async function read(filename) {
    const target = join(root, filename)
    await rejectLink(target)
    if (dirname(await realpath(target)) !== root) throw new Error('scene catalog cannot reference files outside its directory')
    return readJson(target)
  }

  const index = await read('index.json')
  if (!isRecord(index) || index.version !== 1 || !isRecord(index.presets)) throw new Error('invalid scene catalog')
  const scenes = Object.create(null)
  const filenames = new Set()
  for (const [key, filename] of Object.entries(index.presets)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(key) || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9]|index)$/i.test(key)) {
      throw new Error('invalid scene preset key')
    }
    if (filename !== key + '.json' || filenames.has(filename.toLowerCase())) throw new Error('invalid or duplicate scene filename')
    filenames.add(filename.toLowerCase())
    const value = await read(filename)
    if (!isRecord(value) || value.presetKey !== key) throw new Error('scene presetKey must match catalog key')
    scenes[key] = value
    for (const model of value.models ?? []) {
      if (Object.hasOwn(model, 'materialOverrides')) validateModelMaterialBindings(model.materialOverrides)
    }
  }

  const resolved = new Set()
  function visit(key, pending) {
    if (resolved.has(key)) return
    if (!Object.hasOwn(scenes, key) || pending.has(key)) throw new Error('missing base scene or cyclic inheritance')
    const base = scenes[key].extendsPresetKey
    if (base != null) {
      if (typeof base !== 'string') throw new Error('invalid extendsPresetKey')
      visit(base, new Set([...pending, key]))
    }
    resolved.add(key)
  }
  for (const key of Object.keys(scenes)) visit(key, new Set())
  return scenes
}

