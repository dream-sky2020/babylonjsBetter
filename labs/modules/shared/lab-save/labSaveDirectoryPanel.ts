import bundledPreset from '@/config/uiPreviewPresets/lab_save_default.json';
import { parseDialoguePreviewPreset } from '@/core/dialogue-preview/dialoguePreview';
import { loadDialoguePreviewPresetLibrary } from '@/core/dialogue-preview/dialoguePreviewPresetRepository';
import { resolveUiNodeLayout } from '@/core/ui-document/uiDocument.layout';
import type { UiDocument } from '@/core/ui-document/uiDocument.types';
import type { LabSaveListModel } from '@/core/ui/prefabs/基础/LabSaveList.ui';
import { createLabField, createLabStatus, type LabContext } from '@/labs/kit';
import { summarizeLabSave, type LabSaveSummary } from '@/runtime/labSaveFile.mjs';
import { LAB_UI_RUNTIME, type LabUiOverlay } from '../ui-runtime/uiRuntime.service';
import { createLabSaveStorage } from './labSaveStorage';

const defaultPreset = 'lab_save_default';
const binding = 'lab-save.model';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function isCompatible(document: UiDocument): boolean {
  return Object.values(document.nodes).some(node => node.type === 'lab-save-list'
    && node.bindings?.model?.source === binding && resolveUiNodeLayout(document, node.id)?.visible);
}

export function mountLabSaveDirectory(element: HTMLElement, context: LabContext): () => void {
  const { labState, keyboard, services } = context;
  const labId = labState.checkpointLabId!;
  let ownedRuntime: ReturnType<typeof import('../ui-runtime/uiRuntime.labModule')['createLabUiRuntime']> | undefined;
  const storage = createLabSaveStorage(labId);
  const localKey = `babylon-lab-save-preset:${labId}`;
  const preset = document.createElement('select');
  preset.setAttribute('aria-label', '存档 UI 预设');
  const fallback = parseDialoguePreviewPreset(bundledPreset, defaultPreset);
  const documents = new Map([[defaultPreset, fallback]]);
  preset.add(new Option(fallback.name, defaultPreset));
  let preferred = defaultPreset;
  try { preferred = localStorage.getItem(localKey) ?? defaultPreset; } catch { /* Use the bundled default. */ }
  const pathInput = document.createElement('input');
  pathInput.type = 'text';
  pathInput.setAttribute('aria-label', '存档路径');
  pathInput.dataset.labSaveDirectory = 'path';
  pathInput.placeholder = storage.pathHint ?? '通过「选择文件夹」设置';
  pathInput.readOnly = !storage.setDirectory;
  const directoryActions = document.createElement('div');
  directoryActions.className = 'lab-communication-log-actions';
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.textContent = '应用';
  apply.dataset.labSaveDirectory = 'apply';
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.textContent = '选择文件夹';
  choose.dataset.labSaveDirectory = 'choose';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = '恢复默认';
  reset.dataset.labSaveDirectory = 'reset';
  if (storage.setDirectory) directoryActions.append(apply);
  directoryActions.append(choose, reset);
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = '打开存档界面';
  open.dataset.labSaveDirectory = 'open';
  const location = createLabStatus('正在读取存档目录……');
  location.dataset.labSaveDirectory = 'location';
  location.style.overflowWrap = 'anywhere';
  const notice = createLabStatus('');
  notice.setAttribute('role', 'status');
  element.append(createLabField('存档路径', pathInput), directoryActions, location, createLabField('存档 UI 预设', preset), open, notice);

  let disposed = false;
  let busy = false;
  let panelBusy = false;
  let directory = { path: '', label: location.textContent ?? '', ready: false };
  let directoryRequest = 0;
  let overlay: LabUiOverlay | undefined;
  let releaseInput: (() => void) | undefined;
  let rows: LabSaveSummary[] = [];
  let selected: string | null = null;
  let message = '';

  const syncControls = () => {
    const locked = panelBusy || Boolean(overlay);
    pathInput.disabled = reset.disabled = preset.disabled = locked;
    apply.disabled = locked || !pathInput.value.trim();
    choose.disabled = locked || !storage.canChooseDirectory;
    open.disabled = panelBusy || Boolean(overlay) || !documents.has(preset.value);
  };
  const render = () => {
    const model: LabSaveListModel = {
      rows, directory: directory.label, directoryReady: directory.ready, canChooseDirectory: storage.canChooseDirectory,
      selected, busy, message,
    };
    overlay?.update({ [binding]: JSON.stringify(model) });
  };
  const close = () => {
    overlay?.dispose();
    overlay = undefined;
    releaseInput?.();
    releaseInput = undefined;
    syncControls();
  };
  const sortRows = () => rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  const refreshRows = async () => {
    rows = [];
    await refreshDirectory();
    if (!directory.ready || disposed) { selected = null; return; }
    rows = await storage.list();
    sortRows();
    if (!rows.some(row => row.id === selected)) selected = rows[0]?.id ?? null;
  };
  const refreshDirectory = async () => {
    const request = ++directoryRequest;
    try {
      const result = await storage.directory();
      if (request === directoryRequest && !disposed) {
        directory = result;
        pathInput.value = result.path;
        location.textContent = result.label;
        location.hidden = result.label === result.path;
        syncControls();
      }
    } catch (error) {
      if (request === directoryRequest && !disposed) {
        directory = { ...directory, label: '无法读取存档目录。', ready: false };
        location.textContent = directory.label;
        location.hidden = false;
      }
      throw error;
    }
  };
  const chooseDirectory = async (refresh: () => Promise<void>) => {
    try { await storage.choose(); }
    finally { selected = null; await refresh(); }
  };

  const save = async (name: string, previous?: LabSaveSummary) => {
    const snapshot = await labState.captureCheckpoint();
    const stamp = crypto.randomUUID();
    const title = name || `存档 ${new Date(snapshot.createdAt).toLocaleString('zh-CN')}`;
    const slug = title.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 34);
    const id = previous?.id ?? `save-${slug || 'slot'}-${stamp}.json`;
    const archive = {
      ...snapshot,
      slot: { name: title, revision: stamp, saveCount: (previous?.saveCount ?? 0) + 1 },
    };
    const summary = summarizeLabSave(archive, labId, id);
    if (!summary) throw new Error('存档摘要无效。');
    await storage.write(id, JSON.stringify(archive, null, 2), previous?.revision ?? null);
    rows = [...rows.filter(row => row.id !== id), summary];
    sortRows();
    selected = id;
    message = `已保存「${title}」。`;
  };

  const onAction = async (action: string) => {
    if (disposed || !overlay || busy) return;
    if (action === 'close') { close(); return; }
    if (action !== 'choose-directory' && !directory.ready) return;
    if (action.startsWith('select:')) {
      const id = action.slice(7);
      if (rows.some(row => row.id === id)) { selected = id; message = ''; render(); }
      return;
    }
    busy = true;
    message = action === 'load' ? '正在读取存档……' : action.startsWith('delete:') ? '正在删除存档……' : '正在处理存档……';
    render();
    try {
      const item = rows.find(row => row.id === selected);
      if (action === 'choose-directory') {
        await chooseDirectory(refreshRows);
        message = '';
      } else if (action.startsWith('create:')) await save(action.slice(7).trim().slice(0, 80));
      else if (action === 'overwrite' && item) await save(item.name, item);
      else if (action === 'load' && item) {
        const text = await storage.read(item.id);
        if (disposed) return;
        await labState.restoreCheckpoint(JSON.parse(text));
        message = `已读取「${item.name}」。`;
      } else if (item && action === `delete:${item.id}`) {
        await storage.delete(item.id, item.revision);
        rows = rows.filter(row => row.id !== item.id);
        selected = rows[0]?.id ?? null;
        message = `已删除「${item.name}」。`;
      } else if (action === 'refresh') { await refreshRows(); message = ''; }
    } catch (error) { message = errorMessage(error); }
    finally { busy = false; if (!disposed) render(); }
  };

  async function openMenu() {
    if (panelBusy || overlay) return;
    const document = documents.get(preset.value);
    if (!document) return;
    panelBusy = true;
    syncControls();
    notice.textContent = '';
    try {
      let ui = services.find(LAB_UI_RUNTIME) ?? ownedRuntime?.service;
      if (!ui) {
        const { createLabUiRuntime } = await import('../ui-runtime/uiRuntime.labModule');
        if (disposed) return;
        ownedRuntime = createLabUiRuntime(context);
        ui = ownedRuntime.service;
      }
      const handle = await ui.open({
        id: 'lab-save-slots', presetKey: document.presetKey, presetDocument: document, inputMode: 'modal', onAction,
        validatePreset(document) { if (!isCompatible(document)) throw new Error('预设缺少已绑定的存档列表组件。'); },
      });
      if (disposed) { handle.dispose(); return; }
      overlay = handle;
      const lock = keyboard.acquireLock({ ownerId: 'lab:save-menu', label: '存档界面' });
      releaseInput = () => lock.release();
      rows = [];
      busy = true;
      message = '';
      render();
      try { await refreshRows(); }
      catch (error) { message = errorMessage(error); }
      finally { busy = false; if (!disposed) render(); }
    } catch (error) { if (!disposed) { close(); notice.textContent = errorMessage(error); } }
    finally { panelBusy = false; if (!disposed) syncControls(); }
  }

  const changeDirectory = async (update: () => Promise<void>) => {
    if (panelBusy || overlay) return;
    panelBusy = true;
    syncControls();
    notice.textContent = '';
    try { await update(); }
    catch (error) {
      if (!disposed) {
        pathInput.value = directory.path;
        notice.textContent = errorMessage(error);
      }
    }
    finally { panelBusy = false; if (!disposed) syncControls(); }
  };
  choose.addEventListener('click', () => void changeDirectory(() => chooseDirectory(refreshDirectory)));
  apply.addEventListener('click', () => {
    const value = pathInput.value;
    void changeDirectory(async () => { await storage.setDirectory?.(value); await refreshDirectory(); });
  });
  reset.addEventListener('click', () => void changeDirectory(async () => {
    await storage.resetDirectory();
    await refreshDirectory();
  }));
  pathInput.addEventListener('input', syncControls);
  pathInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && storage.setDirectory && !apply.disabled) {
      event.preventDefault();
      apply.click();
    }
  });
  open.addEventListener('click', () => void openMenu());
  preset.addEventListener('change', () => {
    preferred = preset.value;
    try { localStorage.setItem(localKey, preferred); } catch { /* Selection remains available in this session. */ }
  });
  syncControls();
  const refreshPresets = async () => {
    const library = await loadDialoguePreviewPresetLibrary();
    if (disposed) return;
    const current = preset.value;
    for (const [id, document] of Object.entries(library)) {
      if (isCompatible(document)) documents.set(id, document);
    }
    preset.replaceChildren(...[...documents].map(([id, document]) => new Option(document.name, id)));
    preset.value = !panelBusy && !overlay && documents.has(preferred) ? preferred : current;
    syncControls();
  };
  void refreshDirectory().catch(error => { if (!disposed && !overlay) notice.textContent = errorMessage(error); });
  void refreshPresets().catch(() => { /* The bundled default remains available. */ });
  return () => { disposed = true; close(); ownedRuntime?.dispose(); element.replaceChildren(); };
}
