import { invokeNative, isElectronRuntime, type LabSaveRequest } from '@/runtime/nativeBridge';
import { LAB_SAVE_DEV_ROUTE, isLabSaveFileName, summarizeLabSave, type LabSaveSummary } from '@/runtime/labSaveFile.mjs';

type SaveDirectory = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
};
type PickDirectory = (options: { mode: 'readwrite'; startIn: SaveDirectory | 'documents' }) => Promise<SaveDirectory>;
type DirectoryInfo = { path: string; label: string; ready: boolean };
type SaveStorage = {
  readonly canChooseDirectory: boolean;
  readonly pathHint?: string;
  directory(): Promise<DirectoryInfo>;
  choose(): Promise<boolean>;
  setDirectory?(path: string): Promise<void>;
  resetDirectory(): Promise<void>;
  list(): Promise<LabSaveSummary[]>;
  read(id: string): Promise<string>;
  write(id: string, text: string, expectedRevision: string | null): Promise<void>;
  delete(id: string, expectedRevision: string): Promise<void>;
};

async function accessHandle(labId: string, handle?: SaveDirectory | null): Promise<SaveDirectory | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('babylon-lab-save-directories', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('directories');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<SaveDirectory | null>((resolve, reject) => {
      const tx = db.transaction('directories', handle === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('directories');
      const request = handle === undefined ? store.get(labId) : handle ? store.put(handle, labId) : store.delete(labId);
      tx.oncomplete = () => resolve(handle === undefined ? request.result ?? null : handle);
      tx.onabort = () => reject(tx.error ?? request.error);
    });
  } finally { db.close(); }
}

function createBrowserStorage(labId: string): SaveStorage {
  const picker = (window as Window & { showDirectoryPicker?: PickDirectory }).showDirectoryPicker;
  let handle: SaveDirectory | null = null;
  let remembered: Promise<SaveDirectory | null> | undefined;
  const getHandle = () => {
    if (!picker) return Promise.resolve(null);
    if (remembered) return remembered;
    const lookup = accessHandle(labId).then(value => {
      if (remembered === lookup) handle = value;
      return handle;
    });
    remembered = lookup;
    return lookup;
  };
  const requireDirectory = async () => {
    const directory = await getHandle();
    if (!directory || await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      throw new Error('请在「Lab 存档」选择或重新授权存档目录。');
    }
    return directory;
  };
  const getFile = async (directory: SaveDirectory, id: string) => {
    if (!isLabSaveFileName(id)) throw new Error('存档文件名无效。');
    try { return await directory.getFileHandle(id); }
    catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') return null; throw error; }
  };
  const mutate = (id: string, operation: () => Promise<void>) =>
    navigator.locks ? navigator.locks.request(`lab-save:${id}`, operation) : operation();
  return {
    canChooseDirectory: Boolean(picker),
    async directory() {
      if (!picker) return { path: '', label: '当前浏览器不支持目录读写。可使用 Chrome、Electron 或手动导入导出。', ready: false };
      const value = await getHandle();
      if (!value) return { path: '', label: '尚未选择存档目录。', ready: false };
      const ready = await value.queryPermission({ mode: 'readwrite' }) === 'granted';
      return { path: value.name, label: ready ? value.name : `${value.name}（需要重新授权）`, ready };
    },
    async choose() {
      if (!picker) throw new Error('当前浏览器不支持目录读写。');
      try {
        const directory = await picker.call(window, { mode: 'readwrite', startIn: handle ?? 'documents' });
        handle = directory;
        remembered = Promise.resolve(directory);
        await accessHandle(labId, directory);
        return true;
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
        return false;
      }
    },
    async resetDirectory() {
      if (picker) await accessHandle(labId, null);
      handle = null;
      remembered = Promise.resolve(null);
    },
    async list() {
      const directory = await requireDirectory();
      const summaries: LabSaveSummary[] = [];
      for await (const entry of directory.values()) {
        if (entry.kind !== 'file' || !isLabSaveFileName(entry.name)) continue;
        try {
          const text = await (await (entry as FileSystemFileHandle).getFile()).text();
          const summary = summarizeLabSave(JSON.parse(text), labId, entry.name);
          if (summary) summaries.push(summary);
        } catch (error) {
          if (!(error instanceof SyntaxError) && !(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
        }
      }
      return summaries;
    },
    async read(id) {
      const file = await getFile(await requireDirectory(), id);
      if (!file) throw new Error('存档已被移走，请刷新列表。');
      const text = await (await file.getFile()).text();
      if (!summarizeLabSave(JSON.parse(text), labId, id)) throw new Error('存档格式无效，或不属于当前 Lab。');
      return text;
    },
    async write(id, text, expectedRevision) {
      if (!summarizeLabSave(JSON.parse(text), labId, id)) throw new Error('存档内容无效。');
      const directory = await requireDirectory();
      await mutate(id, async () => {
        const file = await getFile(directory, id);
        if (expectedRevision === null) {
          if (file) throw new Error('存档文件已存在，请重新创建。');
        } else {
          const current = file && summarizeLabSave(JSON.parse(await (await file.getFile()).text()), labId, id);
          if (!current || current.revision !== expectedRevision) throw new Error('存档已被修改或移走，请刷新列表后重试。');
        }
        const created = file === null;
        const target = file ?? await directory.getFileHandle(id, { create: true });
        let stream: FileSystemWritableFileStream | undefined;
        try {
          stream = await target.createWritable();
          await stream.write(text);
          await stream.close();
        } catch (error) {
          await stream?.abort().catch(() => {});
          if (created) {
            try {
              const current = await getFile(directory, id);
              if (current && await current.isSameEntry(target) && (await current.getFile()).size === 0) {
                await directory.removeEntry(id);
              }
            } catch { /* Best effort cleanup for an incomplete new save. */ }
          }
          throw error;
        }
      });
    },
    async delete(id, expectedRevision) {
      const directory = await requireDirectory();
      await mutate(id, async () => {
        const file = await getFile(directory, id);
        const current = file && summarizeLabSave(JSON.parse(await (await file.getFile()).text()), labId, id);
        if (!current || current.revision !== expectedRevision) {
          throw new Error('存档已被修改或移走，请刷新列表后重试。');
        }
        await directory.removeEntry(id);
      });
    },
  };
}

function createProjectStorage(labId: string, browser: SaveStorage): SaveStorage {
  const localKey = `babylon-lab-save-directory:${labId}`;
  const defaultPath = `saves/${labId}`;
  let projectPath = defaultPath;
  let mode: 'browser' | 'project' | undefined;
  try {
    const saved = localStorage.getItem(localKey);
    if (saved === '@browser') mode = 'browser';
    else if (saved?.startsWith('saves/')) { projectPath = saved; mode = 'project'; }
  } catch { /* Use this session's selection. */ }
  const remember = (next: 'browser' | 'project', location: string) => {
    mode = next;
    try { localStorage.setItem(localKey, location); } catch { /* Use this session's selection. */ }
  };
  let previousChoice: Promise<boolean> | undefined;
  const usesBrowserDirectory = async () => {
    if (mode) return mode === 'browser';
    previousChoice ??= browser.directory().then(info => Boolean(info.path), () => false);
    const hadSelectedDirectory = await previousChoice;
    return mode ? mode === 'browser' : hadSelectedDirectory;
  };
  async function request<T>(action: 'directory' | 'list' | 'read' | 'write' | 'delete', args = {}, directory = projectPath): Promise<T> {
    const response = await fetch(LAB_SAVE_DEV_ROUTE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...args, labId, action, directory }),
    });
    const value = await response.json().catch(() => { throw new Error('项目存档接口不可用，请重启本地 Vite 服务。'); });
    if (!response.ok) throw new Error(value?.error ?? '项目存档操作失败。');
    return value as T;
  }
  const setDirectory = async (value: string) => {
    const found = await request<{ path: string }>('directory', {}, value);
    projectPath = found.path;
    remember('project', projectPath);
  };
  return {
    canChooseDirectory: browser.canChooseDirectory,
    pathHint: '项目内路径，如 saves/测试存档',
    async directory() {
      if (await usesBrowserDirectory()) return browser.directory();
      const result = await request<{ path: string }>('directory');
      return { path: result.path, label: result.path, ready: true };
    },
    async choose() {
      if (!await browser.choose()) return false;
      remember('browser', '@browser');
      return true;
    },
    setDirectory,
    resetDirectory: () => setDirectory(defaultPath),
    async list() {
      return await usesBrowserDirectory() ? browser.list() : request<LabSaveSummary[]>('list');
    },
    async read(id) {
      return await usesBrowserDirectory() ? browser.read(id) : request<string>('read', { id });
    },
    async write(id, text, expectedRevision) {
      if (await usesBrowserDirectory()) await browser.write(id, text, expectedRevision);
      else await request('write', { id, text, expectedRevision });
    },
    async delete(id, expectedRevision) {
      if (await usesBrowserDirectory()) await browser.delete(id, expectedRevision);
      else await request('delete', { id, expectedRevision });
    },
  };
}

export function createLabSaveStorage(labId: string): SaveStorage {
  if (!isElectronRuntime()) {
    const browser = createBrowserStorage(labId);
    return import.meta.env.DEV ? createProjectStorage(labId, browser) : browser;
  }
  const invoke = <T>(request: LabSaveRequest) => invokeNative<T, 'checkpoint:slots'>('checkpoint:slots', request);
  return {
    canChooseDirectory: true,
    pathHint: '输入文件夹绝对路径',
    directory: () => invoke<DirectoryInfo>({ labId, action: 'directory' }),
    choose: () => invoke<boolean>({ labId, action: 'choose' }),
    setDirectory: path => invoke<void>({ labId, action: 'set-directory', path }),
    resetDirectory: () => invoke<void>({ labId, action: 'reset-directory' }),
    list: () => invoke<LabSaveSummary[]>({ labId, action: 'list' }),
    read: id => invoke<string>({ labId, action: 'read', id }),
    write: (id, text, expectedRevision) => invoke<void>({ labId, action: 'write', id, text, expectedRevision }),
    delete: (id, expectedRevision) => invoke<void>({ labId, action: 'delete', id, expectedRevision }),
  };
}
