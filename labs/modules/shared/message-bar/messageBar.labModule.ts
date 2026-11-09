import { controlSetting, createLabField, createLabStatus, type LabModule } from '@/labs/kit';
import { loadDialoguePreviewPresetLibrary } from '@/core/dialogue-preview/dialoguePreviewPresetRepository';
import { LAB_UI_RUNTIME, type LabUiOverlay } from '../ui-runtime/uiRuntime.service';
import { LAB_MESSAGE_BAR, type LabMessageBar } from './messageBar.service';

const DEFAULT_UI_PRESET = 'message_bar_default';
const ITEMS_BINDING = 'message-bar.items';
const validPresetKey = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 256;

export const messageBarLabModule: LabModule = {
  id: 'message-bar', dependencies: ['ui-runtime'],
  setup(context) {
    const ui = context.services.get(LAB_UI_RUNTIME);
    const config = (context.config?.register('message-bar', {
      'ui-preset': { defaultValue: DEFAULT_UI_PRESET, valid: validPresetKey },
    }) ?? { 'ui-preset': DEFAULT_UI_PRESET }) as { 'ui-preset': string };
    const entries = new Map<string, { text: string; timer: number; channel?: string }>();
    const catalog = new Map<string, string>();
    let nextId = 0;
    let overlay: LabUiOverlay | undefined;
    let ready = false, loading = false, disposed = false;
    let attemptedPreset: string | undefined;
    const values = () => ({ [ITEMS_BINDING]: JSON.stringify([...entries].map(([id, { text }]) => ({ id, text }))) });
    const render = () => overlay?.update(values());
    const remove = (id: string) => {
      window.clearTimeout(entries.get(id)?.timer);
      entries.delete(id);
    };

    const panel = context.ui.addPanel('message-bar', '消息栏');
    const preset = document.createElement('select');
    preset.add(new Option(config['ui-preset'], config['ui-preset']));
    preset.disabled = true;
    const status = createLabStatus('正在读取消息栏 UI 预设……');
    const testText = document.createElement('textarea');
    testText.rows = 2;
    testText.placeholder = '输入要显示的消息';
    const testButton = document.createElement('button');
    testButton.type = 'button';
    testButton.textContent = '测试消息';
    testButton.disabled = true;
    testText.addEventListener('input', () => { testButton.disabled = !testText.value.trim(); });
    panel.content.append(createLabField('UI 预设', preset), status, createLabField('测试文本', testText), testButton);
    const report = (text: string, error = false) => {
      status.textContent = text;
      status.dataset.error = String(error);
    };
    const syncPreset = async () => {
      if (!ready || loading || disposed) return;
      loading = true;
      try {
        while (!disposed && attemptedPreset !== config['ui-preset']) {
          const requested = config['ui-preset'];
          attemptedPreset = requested;
          const key = catalog.has(requested) ? requested : DEFAULT_UI_PRESET;
          overlay?.dispose();
          overlay = undefined;
          try {
            const next = await ui.open({ id: 'message-bar', presetKey: key, context: values(), inputMode: 'passthrough', anchor: 'top-left' });
            if (disposed || requested !== config['ui-preset']) { next.dispose(); continue; }
            overlay = next;
            render();
            if (key === requested) report(`当前 UI：${catalog.get(key) ?? key}`);
            else report(`预设 ${requested} 不可用，正在使用默认消息栏。`, true);
          } catch (error) {
            if (!disposed) report(`无法加载消息栏 UI：${error instanceof Error ? error.message : String(error)}`, true);
          }
        }
      } finally {
        loading = false;
      }
    };
    const settings = context.ui.registerSettings('message-bar', [
      controlSetting('ui-preset', 'UI 预设', preset, { read: () => preset.value || config['ui-preset'], valid: validPresetKey }),
    ], () => {
      if (!context.config && preset.value) config['ui-preset'] = preset.value;
      void syncPreset();
    });

    const service: LabMessageBar = {
      show({ text, durationSeconds = 3, channel }) {
        if (disposed) return;
        const oldest = entries.keys().next().value;
        if (entries.size >= 4 && oldest !== undefined) remove(oldest);
        const id = String(++nextId);
        const timer = window.setTimeout(() => { remove(id); render(); }, durationSeconds * 1000);
        entries.set(id, { text, timer, channel });
        render();
      },
      clear(channel) {
        for (const [id, entry] of entries) {
          if (channel === undefined || channel === entry.channel) remove(id);
        }
        render();
      },
    };
    context.services.set(LAB_MESSAGE_BAR, service);
    testButton.addEventListener('click', () => {
      if (testText.value.trim()) service.show({ text: testText.value });
    });
    return {
      async start() {
        try {
          const library = await loadDialoguePreviewPresetLibrary();
          if (disposed) return;
          for (const [key, document] of Object.entries(library)) {
            const supportsMessages = Object.values(document.nodes).some(node => node.type === 'message-list' && node.bindings?.items?.source === ITEMS_BINDING);
            if (supportsMessages) catalog.set(key, document.name);
          }
          preset.replaceChildren(...[...catalog].map(([key, name]) => new Option(`${name} · ${key}`, key)));
          const requested = config['ui-preset'];
          if (!catalog.has(requested)) preset.add(new Option(`${requested}（不可用）`, requested));
          preset.value = requested;
          preset.disabled = !catalog.size;
        } catch (error) {
          if (!disposed) report(`无法读取 UI 预设目录：${error instanceof Error ? error.message : String(error)}`, true);
          return;
        }
        ready = true;
        await syncPreset();
      },
      dispose() {
        disposed = true;
        context.services.delete(LAB_MESSAGE_BAR);
        overlay?.dispose();
        overlay = undefined;
        service.clear();
        settings.dispose();
        panel.root.remove();
      },
    };
  },
};
