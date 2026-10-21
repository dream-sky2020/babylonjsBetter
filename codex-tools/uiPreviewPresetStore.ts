/// <reference lib="dom" />
import { readFile, writeFile, rename, rm, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseUiDocument, parseUiDocumentLibrary } from '../core/ui-document/uiDocument.ts';

type Catalog = { version: 1; presets: Record<string, { presetKey: string; name: string; file: string }> };
const queues = new Map<string, Promise<unknown>>();
const validKey = (key: string) => /^[A-Za-z0-9_-]+$/.test(key) && !/^(index|__proto__|constructor|prototype|con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(key);
async function safeFile(dir: string, file: string) {
  if (!/^[A-Za-z0-9_-]+\.json$/.test(file)) throw new Error('预设文件名无效');
  const target = path.join(dir, file);
  try { if ((await lstat(target)).isSymbolicLink() || path.dirname(await realpath(target)) !== dir) throw new Error('不允许目录外文件'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return target;
}
async function catalog(dir: string): Promise<Catalog> {
  const value = JSON.parse(await readFile(await safeFile(dir, 'index.json'), 'utf8')) as Catalog;
  if (value.version !== 1 || !value.presets || typeof value.presets !== 'object' || Array.isArray(value.presets)) throw new Error('UI 预设目录无效');
  const files = new Set<string>();
  for (const [key, entry] of Object.entries(value.presets)) {
    if (!validKey(key) || entry.presetKey !== key || entry.file === 'index.json' || files.has(entry.file.toLowerCase())) throw new Error('UI 预设目录条目无效');
    await safeFile(dir, entry.file); files.add(entry.file.toLowerCase());
  }
  return value;
}
async function atomicJson(target: string, value: unknown) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }); }
}
export async function readUiPreviewPresets(directory: string) {
  const dir = await realpath(directory); const index = await catalog(dir);
  return Object.fromEntries(await Promise.all(Object.entries(index.presets).map(async ([key, entry]) => [key, parseUiDocument(JSON.parse(await readFile(await safeFile(dir, entry.file), 'utf8')), key)])));
}
export async function writeUiPreviewPresets(directory: string, raw: unknown) {
  const dir = await realpath(directory);
  const previous = queues.get(dir) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    const library = parseUiDocumentLibrary(raw);
    const index = await catalog(dir);
    const files = new Set(Object.values(index.presets).map(entry => entry.file.toLowerCase()));
    const pending = [];
    // Validate every document and target before writing any file. Omitted presets stay intact.
    for (const [key, document] of Object.entries(library)) {
      if (!validKey(key)) throw new Error(`预设 Key 无效：${key}`);
      const file = index.presets[key]?.file ?? `${key}.json`;
      if (!index.presets[key] && files.has(file.toLowerCase())) throw new Error('预设文件名重复');
      files.add(file.toLowerCase());
      pending.push({ target: await safeFile(dir, file), document });
      index.presets[key] = { presetKey: key, name: document.name, file };
    }
    for (const { target, document } of pending) await atomicJson(target, document);
    await atomicJson(await safeFile(dir, 'index.json'), index);
    return Object.keys(library).length;
  });
  queues.set(dir, operation);
  try { return await operation; } finally { if (queues.get(dir) === operation) queues.delete(dir); }
}
export async function handleUiPreviewPresetRequest(req: IncomingMessage, res: ServerResponse, directory: string) {
  const send = (status: number, payload: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)); };
  try {
    if (req.method === 'GET') { const data = await readUiPreviewPresets(directory); send(200, { success: true, data, count: Object.keys(data).length }); return; }
    if (req.method !== 'PUT') { send(405, { success: false, message: 'method not allowed' }); return; }
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 5 * 1024 * 1024) throw new Error('预设数据超过 5MB'); chunks.push(buffer); }
    const count = await writeUiPreviewPresets(directory, JSON.parse(Buffer.concat(chunks).toString('utf8')));
    send(200, { success: true, count, path: 'config/uiPreviewPresets/' });
  } catch (error) { send(400, { success: false, message: error instanceof Error ? error.message : String(error) }); }
}
