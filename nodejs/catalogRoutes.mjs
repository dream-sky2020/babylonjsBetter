import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { failure, json, readRequestJson } from './http.mjs'
import { fileExists, readJson, rejectLink, slashes, writeAtomic } from './storage.mjs'
import { isRecord } from './validation/jsonValues.mjs'
import { validateDungeonMapPresetPayload } from './validation/presets.mjs'
import { validateDialogueMapLibrary, validateDialoguePreviewLibrary } from './validation/editorPresets.mjs'
import { readSceneEnvironmentPresets } from './sceneEnvironmentPresets.mjs'

const emptyIndex = () => ({ version: 1, presets: {} })
const validKey = /^[A-Za-z0-9_-]+$/
const reserved = /^(?:index|con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

function filenameFor(key, label) {
  if (!validKey.test(key) || reserved.test(key)) throw new Error(label + ' preset key "' + key + '" is not storage-safe')
  return key + '.json'
}

async function readIndex(dir, label, requireIndex) {
  await rejectLink(dir)
  const path = join(dir, 'index.json')
  await rejectLink(path)
  if (!requireIndex && !await fileExists(path)) return emptyIndex()
  const index = await readJson(path)
  if (!isRecord(index) || index.version !== 1 || !isRecord(index.presets)) throw new Error(label + ' preset index is invalid')
  return index
}

async function readPreset(dir, key, entry, label) {
  const filename = filenameFor(key, label)
  if (entry?.file !== filename) throw new Error(label + ' preset "' + key + '" file does not match its key')
  const path = join(dir, filename)
  await rejectLink(path)
  return readJson(path)
}

function planCatalog(dir, label, payload, getName) {
  const files = new Map()
  const names = new Set()
  const catalog = emptyIndex()
  catalog.presets = Object.create(null)
  for (const [key, preset] of Object.entries(payload)) {
    const file = filenameFor(key, label)
    const folded = file.toLowerCase()
    if (names.has(folded)) throw new Error(label + ' preset filenames must be unique')
    names.add(folded)
    catalog.presets[key] = { presetKey: key, name: getName(preset), file }
    files.set(join(dir, file), JSON.stringify(preset, null, 2))
  }
  files.set(join(dir, 'index.json'), JSON.stringify(catalog, null, 2))
  return { files, names }
}

async function commitCatalog(dir, label, files, names) {
  const previous = await readIndex(dir, label, false)
  const before = new Map()
  for (const path of files.keys()) {
    await rejectLink(path)
    before.set(path, await fileExists(path) ? await readFile(path) : null)
  }
  const written = []
  try {
    for (const [path, data] of files) {
      await writeAtomic(path, data)
      written.push(path)
    }
  } catch (error) {
    for (const path of written.reverse()) {
      const original = before.get(path)
      if (original === null) await rm(path, { force: true })
      else await writeAtomic(path, original)
    }
    throw error
  }

  // Publication is complete. Remove only files previously owned by this catalog.
  for (const [key, entry] of Object.entries(previous.presets)) {
    if (validKey.test(key) && !reserved.test(key) && entry?.file === key + '.json' && !names.has(entry.file.toLowerCase())) {
      await rm(join(dir, entry.file), { force: true })
    }
  }
}

export function registerCatalogRoutes(route, configDir, serial) {
  const definitions = [
    ['dungeon-map', 'dungeonMapPresets', 'dungeon map', validateDungeonMapPresetPayload,
      preset => [2, 3].includes(preset.schemaVersion) ? preset.identity.name : preset.name, false],
    ['dialogue-map', 'dialogueMapPresets', 'dialogue map', validateDialogueMapLibrary, preset => preset.name, false],
    ['dialogue-preview', 'uiPreviewPresets', 'dialogue preview', validateDialoguePreviewLibrary, preset => preset.name, true],
  ]
  for (const [endpoint, directory, label, validate, getName, combined] of definitions) {
    const dir = join(configDir, directory)
    const base = '/api/' + endpoint + '-presets'
    route(base, ['GET', 'PUT'], async (request, { method }) => {
      if (method === 'GET') return serial(dir, async () => {
        try {
          const catalog = await readIndex(dir, label, combined)
          const entries = Object.entries(catalog.presets)
          if (!combined) return json({ success: true, count: entries.length, data: catalog })
          const data = Object.fromEntries(await Promise.all(entries.map(async ([key, entry]) =>
            [key, await readPreset(dir, key, entry, label)])))
          const errors = validate(data)
          if (errors.length) throw new Error(errors.slice(0, 10).join('; '))
          return json({ success: true, count: entries.length, data })
        } catch (error) {
          return failure('failed to read ' + label + ' preset' + (combined ? 's: ' : ' index: ') + error.message, 500)
        }
      })

      const payload = await readRequestJson(request)
      const errors = validate(payload)
      if (errors.length) return failure(label + ' presets validation failed', 400, { errors: errors.slice(0, 50) })
      let plan
      try {
        plan = planCatalog(dir, label, payload, getName)
      } catch (error) {
        return failure(label + ' presets validation failed', 400, { errors: [error.message] })
      }
      return serial(dir, async () => {
        try {
          await commitCatalog(dir, label, plan.files, plan.names)
          return json({ success: true, count: Object.keys(payload).length, path: slashes(dir) })
        } catch (error) {
          return failure('failed to write ' + label + ' presets: ' + error.message, 500)
        }
      })
    })
    if (!combined) route(new RegExp('^' + base + '/([^/]+)$'), ['GET'], (_request, { params: [key] }) =>
      serial(dir, async () => {
        try {
          const idx = await readIndex(dir, label, false)
          const entry = Object.hasOwn(idx.presets, key) && idx.presets[key]
          if (!isRecord(entry)) return failure(label + ' preset "' + key + '" does not exist', 404)
          const data = await readPreset(dir, key, entry, label)
          const errors = validate({ [key]: data })
          if (errors.length) return failure(label + ' preset validation failed', 500, { errors: errors.slice(0, 50) })
          return json({ success: true, data })
        } catch (error) {
          return failure('failed to read ' + label + ' preset: ' + error.message, 500)
        }
      }))
  }
  route('/api/scene-environment-presets', ['GET'], async () => {
    try {
      const data = await readSceneEnvironmentPresets(join(configDir, 'sceneEnvironmentPresets'))
      return json({ success: true, count: Object.keys(data).length, data })
    } catch (error) {
      return failure('failed to read scene environment presets: ' + error.message, 500)
    }
  })
}

