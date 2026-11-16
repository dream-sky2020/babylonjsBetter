import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { json, readRequestJson, RequestError } from './http.mjs'
import { rejectLink, writeAtomic } from './storage.mjs'
import { isRecord } from './validation/jsonValues.mjs'

const key = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/
const reservedKeys = new Set(['__proto__', 'prototype', 'constructor'])
const revisionOf = buffer => createHash('sha256').update(buffer).digest('hex')
const invalidDocument = 'Lab 配置格式、版本、ID 或参数无效。'

function validValue(value, depth) {
  if (depth > 20) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(item => validValue(item, depth + 1))
  return isRecord(value) && Object.entries(value).every(([name, item]) =>
    key.test(name) && !reservedKeys.has(name) && validValue(item, depth + 1))
}

function validateDocument(data, labId) {
  return isRecord(data) && data.format === 'lab-config' && data.version === 1
    && data.labId === labId && isRecord(data.modules) && validValue(data.modules, 0)
    && Object.values(data.modules).every(isRecord)
}

export function registerLabConfigRoutes(route, directory, serial) {
  const error = (message, status) => json({ error: message }, status)
  route(/^\/api\/lab-configs\/([^/]+)$/, ['GET', 'PUT'], async (request, { method, params: [labId] }) => {
    if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(labId)) return error('无效的 Lab ID。', 400)
    const target = join(directory, labId + '.json')
    let payload
    if (method === 'PUT') {
      try {
        payload = await readRequestJson(request, 2 * 1024 * 1024)
      } catch (cause) {
        if (cause instanceof RequestError) return error('配置文件过大。', 413)
        throw cause
      }
    }
    return serial(target, async () => {
      try {
        await rejectLink(directory)
        await rejectLink(target)
        const previous = await readFile(target).catch(cause => {
          if (cause.code === 'ENOENT') return null
          throw cause
        })
        const revision = previous === null ? null : revisionOf(previous)
        if (method === 'GET') {
          if (previous === null) return error('缺少此 Lab 的配置文件。', 400)
          const data = JSON.parse(previous.toString('utf8'))
          if (!validateDocument(data, labId)) return error(invalidDocument, 400)
          return json({ data, revision })
        }
        if (!isRecord(payload) || !Object.hasOwn(payload, 'revision')) return error('保存请求缺少版本信息。', 400)
        const { data } = payload
        if (!validateDocument(data, labId)) return error(invalidDocument, 400)
        if (payload.revision !== revision) return error('配置已被其他页面修改，请刷新并核对后保存。', 409)
        const encoded = Buffer.from(JSON.stringify(data, null, 2) + '\n')
        await writeAtomic(target, encoded, true)
        return json({ data, revision: revisionOf(encoded) })
      } catch (cause) {
        if (cause instanceof SyntaxError) return error(cause.message, 400)
        return error('无法读写 Lab 配置文件，请检查目录权限。', 500)
      }
    })
  })
}

