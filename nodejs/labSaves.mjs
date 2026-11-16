import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { isLabSaveFileName } from '../runtime/labSaveFile.mjs'
import { isLabSaveLabId, listSaveFiles, readSaveFile, writeSaveFile } from '../runtime/labSaveDisk.mjs'
import { json, readBody } from './http.mjs'

const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLocalRequest(request) {
  const address = request.socket.remoteAddress?.replace(/^::ffff:/, '')
  if (address !== '127.0.0.1' && address !== '::1') return false
  try {
    const protocol = request.socket.encrypted ? 'https' : 'http'
    const host = new URL(protocol + '://' + request.headers.host)
    return localHostnames.has(host.hostname)
      && (!request.headers.origin || request.headers.origin === host.origin)
      && (!request.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(String(request.headers['sec-fetch-site'])))
  } catch {
    return false
  }
}

function directoryParts(input) {
  const text = typeof input === 'string' ? input.trim().replaceAll('\\', '/').replace(/\/+$/, '') : ''
  const parts = text.split('/')
  if (parts.length < 2 || parts[0] !== 'saves' || parts.slice(1).some(segment =>
    !segment || segment.startsWith('.') || segment !== segment.trim() || segment.endsWith('.')
    || !isLabSaveFileName(segment + '.json'))) {
    throw new Error('请输入项目内的 saves/ 子目录。项目外的目录请使用「选择文件夹」。')
  }
  return parts
}

async function projectDirectory(root, parts) {
  let directory = root
  for (const part of parts) {
    directory = path.join(directory, part)
    try {
      await fs.mkdir(directory)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
    if (!(await fs.lstat(directory)).isDirectory()) throw new Error('存档路径必须是项目内的普通文件夹。')
  }
  await fs.access(directory, constants.R_OK | constants.W_OK)
  return directory
}

function saveResponse(status, body) {
  return { ...json(body, status), headers: { 'Cache-Control': 'no-store' } }
}

// The save route requires a same-origin request even from other loopback ports.
export async function handleLabSave(request, root) {
  if (!isLocalRequest(request)) return saveResponse(403, { error: '项目存档接口只接受本机同源请求。' })
  if (request.method !== 'POST') return saveResponse(405, { error: '存档接口需要 POST 请求。' })
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    return saveResponse(415, { error: '存档接口需要 JSON。' })
  }

  try {
    const body = await readBody(request, Infinity)
    const { labId, action, directory: input, id, text, expectedRevision } = JSON.parse(body.toString('utf8'))
    if (!isLabSaveLabId(labId)) throw new Error('Lab ID 无效。')
    if (!['directory', 'list', 'read', 'write'].includes(action)) throw new Error('未知的存档操作。')
    const parts = directoryParts(input ?? ('saves/' + labId))
    const directory = await projectDirectory(root, parts)
    if (action === 'directory') return saveResponse(200, { path: parts.join('/') })
    if (action === 'list') return saveResponse(200, await listSaveFiles(directory, labId))
    if (action === 'read') return saveResponse(200, await readSaveFile(directory, labId, id))
    await writeSaveFile(directory, labId, id, text, expectedRevision)
    return saveResponse(200, null)
  } catch (error) {
    return saveResponse(400, { error: error instanceof Error ? error.message : '存档操作失败。' })
  }
}

