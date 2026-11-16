import { createReadStream } from 'node:fs'
import { realpath, readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { failure, json, readBody, readRequestJson, text } from './http.mjs'
import { checkedPath, fileExists, internalPath, isInside, slashes, writeAtomic } from './storage.mjs'
import { isRecord } from './validation/jsonValues.mjs'
import { pickImage } from './imagePicker.mjs'

const contentTypes = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.bmp', 'image/bmp'], ['.svg', 'image/svg+xml'],
])
const imageType = path => contentTypes.get(extname(path).toLowerCase())
const imageOnly = 'Only image files are allowed'
const resourcePath = path => 'resources/' + path.replace(/^\/+/, '')

function publicImage(publicDir, path) {
  const publicPath = slashes(relative(publicDir, path))
  return {
    success: true,
    name: basename(path),
    relativePath: publicPath,
    publicPath,
    resourcePath: publicPath.startsWith('resources/') ? publicPath : resourcePath(publicPath),
    url: '/' + publicPath,
    absolutePath: slashes(path),
  }
}

async function* filesIn(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return
    throw error
  }
  for (const entry of entries) {
    if (entry.isFile()) yield join(dir, entry.name)
  }
  for (const entry of entries) {
    if (entry.isDirectory()) yield* filesIn(join(dir, entry.name))
  }
}

async function sendImage(request, path, maxAge) {
  const info = await stat(path)
  if (!info.isFile()) return text('File not found', 404)
  const headers = {
    'Content-Type': imageType(path),
    'Content-Length': info.size,
    'Last-Modified': info.mtime.toUTCString(),
    'Cache-Control': maxAge ? 'public, max-age=' + maxAge : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    // SVG assets can be loaded as images while direct navigation cannot execute scripts.
    'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
  }
  const changedSince = Date.parse(request.headers['if-modified-since'])
  if (Number.isFinite(changedSince) && Date.parse(headers['Last-Modified']) <= changedSince) {
    delete headers['Content-Length']
    return { status: 304, headers }
  }
  return { status: 200, headers, stream: () => createReadStream(path) }
}

function imageRoute(root) {
  return async (request, { params: [path] }) => {
    const target = resolve(root, internalPath(path))
    if (!isInside(root, target)) return text('Invalid path', 400)
    if (!imageType(target)) return text(imageOnly, 403)
    try {
      await checkedPath(root, target)
      return await sendImage(request, target)
    } catch {
      return text('File not found', 404)
    }
  }
}

function secureFilename(value) {
  const name = value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    .replace(/[\\/]/g, ' ').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '').replace(/^[._]+|[._]+$/g, '')
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' + name : name
}

export function registerResourceRoutes(route, { publicDir, imageDir, pick = pickImage, servePublicResources }) {
  const resources = join(publicDir, 'resources')
  route('/health', ['GET'], () => json({ ok: true, imageDir: slashes(imageDir), publicDir: slashes(publicDir) }))
  if (servePublicResources) route(/^\/resources\/(.+)$/, ['GET'], imageRoute(resources))
  route(/^\/images\/(.+)$/, ['GET'], imageRoute(imageDir))
  route('/api/images', ['GET'], async () => {
    if (!await stat(imageDir).then(info => info.isDirectory()).catch(() => false)) {
      return failure('目录不存在: ' + imageDir, 404)
    }
    const items = []
    for await (const path of filesIn(imageDir)) {
      if (!imageType(path)) continue
      const relativePath = slashes(relative(imageDir, path))
      items.push({ name: basename(path), relativePath, url: '/images/' + relativePath, absolutePath: slashes(path) })
    }
    items.sort((a, b) => Number(a.relativePath > b.relativePath) - Number(a.relativePath < b.relativePath))
    return json({ success: true, count: items.length, items })
  })

  route('/api/find_resource_by_name', ['GET'], async (_request, { query }) => {
    const name = (query.get('name') ?? '').trim()
    if (!name) return failure('missing name', 400)
    if (!imageType(name)) return failure(imageOnly, 403)
    for await (const path of filesIn(publicDir)) {
      if (basename(path).toLowerCase() === name.toLowerCase()) return json(publicImage(publicDir, path))
    }
    return failure('not found', 404)
  })

  route('/api/pick_public_image', ['POST'], async request => {
    const payload = await readRequestJson(request)
    const current = resolve(publicDir, internalPath(String(payload?.currentPath ?? '').trim()))
    let initialDir = publicDir
    try {
      await checkedPath(publicDir, current)
      if (isInside(publicDir, current)) {
        const info = await stat(current).catch(() => null)
        const candidate = info?.isDirectory() ? current : dirname(current)
        if (await stat(candidate).then(value => value.isDirectory())) initialDir = candidate
      }
    } catch {
      // Deleted and external paths fall back to public.
    }
    const title = typeof payload?.title === 'string' ? payload.title : '选择 public 下图片'
    let path
    try {
      path = await pick({ title, initialDir })
    } catch (error) {
      return failure('无法打开图片选择窗口: ' + error.message, 500)
    }
    if (!path) return failure('cancelled', 200, { cancelled: true })
    path = resolve(path)
    if (!await fileExists(path)) return failure('file not found', 404)
    try {
      await checkedPath(publicDir, path)
    } catch {
      return failure('不合法的文件或路径', 403)
    }
    return imageType(path) ? json(publicImage(publicDir, path)) : failure('不合法的文件或路径', 403)
  })

  route('/api/upload_image', ['POST'], async request => {
    const contentType = request.headers['content-type'] ?? ''
    if (!/^multipart\/form-data(?:\s*;|$)/i.test(contentType)) return failure('missing file', 400)
    const body = await readBody(request, 32 * 1024 * 1024)
    const form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string' || !file.name) return failure('missing file', 400)
    if (!imageType(file.name)) return failure(imageOnly, 403)
    const directory = secureFilename(String(form.get('subdir') ?? 'skill-assets')) || 'skill-assets'
    const extension = extname(file.name)
    const name = (secureFilename(basename(file.name, extension)) || 'image') + extension.toLowerCase()
    const target = join(resources, directory, name)
    await checkedPath(publicDir, target)
    await writeAtomic(target, Buffer.from(await file.arrayBuffer()))
    const relativePath = slashes(relative(resources, target))
    return json({ success: true, name, relativePath, resourcePath: resourcePath(relativePath), url: '/' + resourcePath(relativePath) })
  })

  route('/api/atlas-json', ['PUT'], async request => {
    const payload = await readRequestJson(request)
    const rawPath = String(payload?.path ?? '').trim()
    const data = payload?.data
    if (!rawPath) return failure('missing path', 400)
    if (!isRecord(data)) return failure('data must be a json object', 400)
    let path = internalPath(rawPath).replace(/^\/+/, '').replace(/^public\//, '')
    if (!path.toLowerCase().endsWith('.json')) path += '.json'
    const target = resolve(publicDir, path)
    try {
      await checkedPath(publicDir, target)
    } catch {
      return failure('path outside public is not allowed', 403)
    }
    if (!isRecord(data.meta)) return failure('atlas data missing meta object', 400)
    if (typeof data.meta.image !== 'string' || !data.meta.image.trim()) return failure('meta.image is required', 400)
    try {
      await writeAtomic(target, JSON.stringify(data, null, 2))
      return json({ success: true, path: slashes(target), publicPath: slashes(relative(publicDir, target)) })
    } catch (error) {
      return failure('写入 atlas json 失败: ' + error.message, 500)
    }
  })

  route('/proxy_local_image', ['GET'], async (request, { query }) => {
    const path = resolve((query.get('path') ?? '').trim())
    const root = [publicDir, imageDir].find(directory => isInside(directory, path))
    if (!root) return text('File not found', 404)
    if (!imageType(path)) return text(imageOnly, 403)
    try {
      const resolved = await realpath(await checkedPath(root, path))
      return await sendImage(request, resolved, 3600)
    } catch {
      return text('File not found', 404)
    }
  })
}

