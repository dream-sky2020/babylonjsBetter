import type { LabConfig } from './LabConfig';
import { saveLabConfig } from './labConfigTransport';

export function mountLabConfigToolbar(header: HTMLElement, config: LabConfig, revision: string | null, validate: () => void, importLegacy: () => number): () => void {
  const root = document.createElement('div'); root.className = 'lab-config-toolbar';
  const label = document.createElement('span'); label.className = 'lab-config-status'; label.dataset.labConfigStatus = '';
  label.setAttribute('role', 'status');
  const save = document.createElement('button'); save.type = 'button'; save.textContent = '保存 Lab 配置'; save.dataset.labConfigSave = '';
  const migrate = document.createElement('button'); migrate.type = 'button'; migrate.textContent = '导入旧本机参数';
  migrate.title = '将当前页面以前记住的有效参数导入运行配置，保存后才写入配置文件。';
  migrate.hidden = !import.meta.env.DEV;
  let saving = false, disposed = false, failure = '';
  const refresh = () => {
    label.textContent = failure || (saving ? '正在保存…' : config.dirty ? '配置有未保存修改' : '配置已加载');
    label.dataset.error = String(!!failure); label.title = label.textContent;
    save.disabled = saving || !import.meta.env.DEV;
  };
  save.addEventListener('click', async () => {
    if (saving || disposed) return;
    failure = '';
    try {
      validate();
      const document = config.snapshot();
      saving = true; refresh();
      const result = await saveLabConfig(document, revision);
      if (disposed) return;
      revision = result.revision; config.markSaved(result.document);
    } catch (error) { failure = error instanceof Error ? error.message : String(error); }
    finally { saving = false; if (!disposed) refresh(); }
  });
  const unsubscribe = config.subscribe(() => { failure = ''; refresh(); });
  migrate.addEventListener('click', () => {
    try { const count = importLegacy(); failure = ''; refresh(); label.textContent = `已导入 ${count} 项本机参数，请保存配置`; label.title = label.textContent; }
    catch (error) { failure = error instanceof Error ? error.message : String(error); refresh(); }
  });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (config.dirty) { event.preventDefault(); event.returnValue = ''; }
  };
  window.addEventListener('beforeunload', beforeUnload);
  root.append(save, migrate);
  const statuses = header.querySelector('.lab-header-statuses') ?? header;
  statuses.insertBefore(label, statuses.querySelector('.lab-global-status'));
  header.append(root); refresh();
  return () => { disposed = true; unsubscribe(); window.removeEventListener('beforeunload', beforeUnload); label.remove(); root.remove(); };
}
