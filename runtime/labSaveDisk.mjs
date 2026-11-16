import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isLabSaveFileName, summarizeLabSave } from './labSaveFile.mjs';

/** @param {unknown} id */
export const isLabSaveLabId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(id);

/** @param {string} file */
export async function readSaveText(file) {
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!stat.isFile()) throw new Error('存档位置不是普通文件。');
  return fs.readFile(file, 'utf8');
}

/** @param {string} file @param {string} text */
export async function writeSaveAtomically(file, text) {
  const temp = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
  const handle = await fs.open(temp, 'wx');
  try {
    try { await handle.writeFile(text, 'utf8'); }
    finally { await handle.close(); }
    await fs.rename(temp, file);
  } finally { await fs.rm(temp, { force: true }); }
}

/** @param {string} directory @param {string} labId */
export async function listSaveFiles(directory, labId) {
  const files = await fs.readdir(directory, { withFileTypes: true });
  const summaries = [];
  for (const file of files) {
    if (!file.isFile() || !isLabSaveFileName(file.name)) continue;
    try {
      const text = await readSaveText(path.join(directory, file.name));
      const summary = text && summarizeLabSave(JSON.parse(text), labId, file.name);
      if (summary) summaries.push(summary);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return summaries;
}

/** @param {string} directory @param {string} labId @param {string} id */
export async function readSaveFile(directory, labId, id) {
  if (!isLabSaveFileName(id)) throw new Error('存档文件名无效。');
  const text = await readSaveText(path.join(directory, id));
  if (!text || !summarizeLabSave(JSON.parse(text), labId, id)) {
    throw new Error('存档不存在，或不属于当前 Lab。');
  }
  return text;
}

/** @type {Map<string, Promise<void>>} */
const writes = new Map();

/** @param {string} directory @param {string} labId @param {string} id @param {string} text @param {string|null} expectedRevision */
export async function writeSaveFile(directory, labId, id, text, expectedRevision) {
  if (!isLabSaveFileName(id) || typeof text !== 'string'
      || !summarizeLabSave(JSON.parse(text), labId, id)) throw new Error('存档内容无效。');
  const file = path.join(directory, id);
  const key = process.platform === 'win32' ? file.toLowerCase() : file;
  const previous = writes.get(key);
  const writing = (async () => {
    if (previous) await previous.catch(() => {});
    const oldText = await readSaveText(file);
    const current = oldText && summarizeLabSave(JSON.parse(oldText), labId, id);
    if (expectedRevision === null ? oldText !== null : !current || current.revision !== expectedRevision) {
      throw new Error('存档已被修改或移走，请刷新列表后重试。');
    }
    await writeSaveAtomically(file, text);
  })();
  writes.set(key, writing);
  try { await writing; }
  finally { if (writes.get(key) === writing) writes.delete(key); }
}
