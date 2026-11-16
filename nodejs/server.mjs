import { createServer } from 'node:http'
import { mkdir, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { pipeline } from 'node:stream/promises'
import { registerCatalogRoutes } from './catalogRoutes.mjs'
import { registerConfigRoutes } from './configRoutes.mjs'
import { registerLabConfigRoutes } from './labConfigs.mjs'
import { handleLabSave } from './labSaves.mjs'
import { registerResourceRoutes } from './resourceRoutes.mjs'
import { failure, RequestError } from './http.mjs'
import { serialOperations } from './storage.mjs'
import { LAB_SAVE_DEV_ROUTE } from '../runtime/labSaveFile.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const defaultImageDir = join(projectRoot, 'python', 'Identity_Skill_Icons')
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]'])
const portMin = 4550
const portMax = 4600

function isLocalUrl(value) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && loopback.has(url.hostname)
  } catch {
    return false
  }
}

function matchRoute(pattern, path) {
  if (typeof pattern === 'string') return pattern === path ? [] : null
  const match = pattern.exec(path)
  return match ? match.slice(1) : null
}

async function respond(response, result, method) {
  for (const [key, value] of Object.entries(result.headers ?? {})) response.setHeader(key, value)
  response.statusCode = result.status
  if (result.stream) {
    if (method === 'HEAD') response.end()
    else await pipeline(result.stream(), response)
    return
  }
  if (result.body === undefined) {
    response.end()
    return
  }
  const body = result.raw ? result.body : JSON.stringify(result.body)
  if (!response.hasHeader('Content-Type')) response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Content-Length', Buffer.byteLength(body))
  response.end(method === 'HEAD' ? undefined : body)
}

export function createBackendHandler({
  root = projectRoot, imageDir = root === projectRoot ? defaultImageDir : join(root, 'python', 'Identity_Skill_Icons'),
  pick, servePublicResources = true,
} = {}) {
  const configDir = resolve(root, 'config')
  const publicDir = resolve(root, 'public')
  const serial = serialOperations()
  const routes = []
  function route(pattern, methods, handler) {
    const allowed = methods.includes('GET') ? [...methods, 'HEAD', 'OPTIONS'] : [...methods, 'OPTIONS']
    routes.push({ pattern, allowed, handler })
  }

  registerResourceRoutes(route, { publicDir, imageDir: resolve(imageDir), pick, servePublicResources })
  registerConfigRoutes(route, configDir, serial)
  registerCatalogRoutes(route, configDir, serial)
  registerLabConfigRoutes(route, join(configDir, 'labs'), serial)

  return async (request, response, next) => {
    const { method, headers } = request
    try {
      const separator = request.url.indexOf('?')
      const rawPath = separator === -1 ? request.url : request.url.slice(0, separator)
      if (rawPath === LAB_SAVE_DEV_ROUTE) {
        return await respond(response, await handleLabSave(request, root), method)
      }
      const path = decodeURIComponent(rawPath)
      const registered = routes.find(({ pattern }) => matchRoute(pattern, path) !== null)
      if (!registered) {
        if (next) return next()
        return await respond(response, failure('not found', 404), method)
      }
      if (!isLocalUrl('http://' + (headers.host ?? ''))) return await respond(response, failure('local host required', 403), method)
      response.setHeader('Vary', 'Origin')
      if (headers.origin) {
        if (!isLocalUrl(headers.origin)) return await respond(response, failure('local origin required', 403), method)
        response.setHeader('Access-Control-Allow-Origin', headers.origin)
      }

      const { pattern, allowed, handler } = registered
      if (method === 'OPTIONS') {
        const allow = allowed.join(', ')
        return await respond(response, { status: 200, headers: {
          Allow: allow,
          'Access-Control-Allow-Methods': allow,
          'Access-Control-Allow-Headers': 'Content-Type',
        } }, method)
      }
      if (!allowed.includes(method)) {
        return await respond(response, { ...failure('method not allowed', 405), headers: { Allow: allowed.join(', ') } }, method)
      }
      const query = new URLSearchParams(separator === -1 ? '' : request.url.slice(separator + 1))
      const result = await handler(request, { params: matchRoute(pattern, path), query, method: method === 'HEAD' ? 'GET' : method })
      await respond(response, result, method)
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy()
        return
      }
      if (error instanceof RequestError) await respond(response, failure(error.message, error.status), method)
      else if (error instanceof URIError) await respond(response, failure('Invalid path', 400), method)
      else {
        console.error(error)
        await respond(response, failure('internal server error', 500), method)
      }
    }
  }
}

export function createBackend(options) {
  return createServer(createBackendHandler(options))
}

async function listen(server, host, preferredPort) {
  let port = preferredPort >= portMin && preferredPort <= portMax ? preferredPort : portMin
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen)
        server.listen(port, host, () => {
          server.off('error', rejectListen)
          resolveListen()
        })
      })
      return port
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error
      port = port === portMax ? portMin : port + 1
    }
  }
  throw new Error('无法绑定开发端口：已尝试 4550-4600（最多 50 次）')
}

async function main() {
  const { values } = parseArgs({ options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: String(portMin) },
    'image-dir': { type: 'string', default: defaultImageDir },
    help: { type: 'boolean', short: 'h' },
  } })
  if (values.help) {
    console.log('Usage: node nodejs/server.mjs [--host 127.0.0.1] [--port 4550] [--image-dir PATH]')
    return
  }
  const host = values.host === '[::1]' ? '::1' : values.host
  if (![...loopback, '::1'].includes(host)) throw new Error('本地后端只能监听回环地址。')
  if (!/^[+-]?\d+$/.test(values.port)) throw new Error('--port must be an integer')
  const imageDir = resolve(values['image-dir'])
  await Promise.all([
    mkdir(imageDir, { recursive: true }),
    mkdir(join(projectRoot, 'public', 'resources'), { recursive: true }),
  ])
  const port = await listen(createBackend({ imageDir }), host, Number(values.port))
  console.log('Node.js 本地后端已启动 -> http://' + (host === '::1' ? '[::1]' : host) + ':' + port + ' | 图片池: ' + imageDir)
}

if (process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => null) === fileURLToPath(import.meta.url)) {
  await main()
}

