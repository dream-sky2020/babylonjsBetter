/** @typedef {{ id: string, name: string, map: string | null, version: number, createdAt: string, runTimeMs: number | null, saveCount: number | null, revision: string }} LabSaveSummary */

export const LAB_SAVE_DEV_ROUTE = '/api/lab-saves';

/** @param {string} fileName */
export const isLabSaveFileName = fileName => typeof fileName === 'string'
  && fileName.length <= 255 && !fileName.startsWith('.')
  && fileName.toLowerCase().endsWith('.json')
  && !/[<>:"/\\|?*\u0000-\u001f]/.test(fileName)
  && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])\./i.test(fileName);

/**
 * @param {unknown} value
 * @param {string} labId
 * @param {string} id
 * @returns {LabSaveSummary | undefined}
 */
export function summarizeLabSave(value, labId, id) {
  if (!value || typeof value !== 'object' || !isLabSaveFileName(id)) return;
  const data = /** @type {Record<string, any>} */ (value);
  if (data.format !== 'lab-checkpoint' || data.version !== 1 || data.labId !== labId
    || typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt))
    || !data.modules || typeof data.modules !== 'object' || Array.isArray(data.modules)) return;
  const time = data.runTimeMs;
  if (time !== undefined && (!Number.isSafeInteger(time) || time < 0)) return;
  const slot = data.slot;
  if (slot !== undefined && (!slot || typeof slot.name !== 'string' || !slot.name.trim() || slot.name.length > 80
    || !Number.isSafeInteger(slot.saveCount) || slot.saveCount < 1
    || typeof slot.revision !== 'string' || !slot.revision || slot.revision.length > 128)) return;
  const map = data.modules['dungeon-map-loader']?.['active-map']?.data;
  return {
    id,
    name: slot?.name ?? id.slice(0, -5),
    map: typeof map === 'string' ? map : null,
    version: data.version,
    createdAt: data.createdAt,
    runTimeMs: time ?? null,
    saveCount: slot?.saveCount ?? null,
    revision: slot?.revision ?? data.createdAt,
  };
}
