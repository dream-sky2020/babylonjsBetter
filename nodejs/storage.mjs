import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, sep } from 'node:path'

export const slashes = path => path.split(sep).join('/')
export const internalPath = path => path.replaceAll('\\', '/')

export function isInside(root, path) {
  const rel = relative(root, path)
  return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)
}

export async function fileExists(path) {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false
    throw error
  }
}

export async function rejectLink(path) {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error('symbolic link is not allowed')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

// Check the closest existing ancestor without creating directories outside the root.
export async function checkedPath(root, target) {
  if (!isInside(root, target)) throw new Error('path is outside its allowed directory')
  let ancestor = target
  const rootPath = await realpath(root)
  while (isInside(root, ancestor)) {
    try {
      const resolved = await realpath(ancestor)
      if (!isInside(rootPath, resolved)) throw new Error('path is outside its allowed directory')
      return target
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await rejectLink(ancestor)
      ancestor = dirname(ancestor)
    }
  }
  throw new Error('path is outside its allowed directory')
}

export const readJson = async path => JSON.parse(await readFile(path, 'utf8'))

export async function writeAtomic(path, content, durable = false) {
  await mkdir(dirname(path), { recursive: true })
  const temp = path + '.' + randomUUID() + '.tmp'
  try {
    const file = await open(temp, 'wx')
    try {
      await file.writeFile(content)
      if (durable) await file.sync()
    } finally {
      await file.close()
    }
    await rename(temp, path)
  } finally {
    await rm(temp, { force: true })
  }
}

export function serialOperations() {
  const queues = new Map()
  return (key, operation) => {
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(operation)
    queues.set(key, next)
    return next.finally(() => {
      if (queues.get(key) === next) queues.delete(key)
    })
  }
}

