import type { LabUi } from '../labUi.ts';
import { createLabJson, createLabSwitch } from '../labUi.ts';
import type { LabKeyboardRouter } from './LabKeyboardRouter.ts';

const focusDescription = (): string => {
  const active = document.activeElement;
  if (!active) return '无';
  if (active instanceof HTMLCanvasElement) return 'Babylon Canvas';
  if (active instanceof HTMLInputElement) return `input${active.dataset.field ? ` · ${active.dataset.field}` : ''}`;
  if (active instanceof HTMLTextAreaElement) return 'textarea';
  if (active instanceof HTMLSelectElement) return 'select';
  return active.tagName.toLowerCase();
};

export const createLabKeyboardDebugPanel = (ui: LabUi, keyboard: LabKeyboardRouter): (() => void) => {
  const panel = ui.addPanel('system-keyboard-input', 'Keyboard Input', { defaultCollapsed: true });
  panel.root.classList.add('lab-system-panel');
  const globalToggle = createLabSwitch('全局键盘输入', keyboard.globalEnabled);
  const summary = document.createElement('div');
  summary.className = 'lab-inline-status';
  const consumers = document.createElement('div');
  consumers.className = 'lab-keyboard-consumers';
  const routes = createLabJson('尚无键盘路由记录。');
  routes.classList.add('lab-keyboard-routes');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = '清空键盘路由记录';
  panel.content.append(globalToggle.row, summary, consumers, routes, clear);

  const render = (): void => {
    globalToggle.input.checked = keyboard.globalEnabled;
    summary.textContent = `焦点：${focusDescription()} · 当前按下：${[...keyboard.pressed].join(', ') || '无'} · 消费者：${keyboard.getConsumers().length}`;
    consumers.replaceChildren();
    keyboard.getConsumers().forEach((consumer) => {
      const card = document.createElement('div');
      card.className = 'lab-keyboard-consumer';
      const title = document.createElement('strong');
      title.textContent = consumer.label;
      const id = document.createElement('small');
      id.textContent = `${consumer.id} · 按键 ${consumer.keys.join(', ') || '无'}`;
      const owned = document.createElement('small');
      owned.textContent = `当前优先拥有：${consumer.ownedCodes.join(', ') || '无'}`;
      const enabled = createLabSwitch('启用', consumer.enabled);
      const intercept = createLabSwitch('处理后拦截低优先级', consumer.intercept);
      const prevent = createLabSwitch('阻止浏览器默认行为', consumer.preventDefault);
      const priorityLabel = document.createElement('label');
      priorityLabel.className = 'lab-field';
      const priorityText = document.createElement('span');
      priorityText.textContent = '优先级';
      const priority = document.createElement('input');
      priority.type = 'number';
      priority.step = '1';
      priority.value = String(consumer.priority);
      priorityLabel.append(priorityText, priority);
      enabled.input.addEventListener('change', () => keyboard.configureConsumer(consumer.id, { enabled: enabled.input.checked }));
      intercept.input.addEventListener('change', () => keyboard.configureConsumer(consumer.id, { intercept: intercept.input.checked }));
      prevent.input.addEventListener('change', () => keyboard.configureConsumer(consumer.id, { preventDefault: prevent.input.checked }));
      priority.addEventListener('input', () => {
        const value = Number(priority.value);
        if (Number.isFinite(value)) keyboard.configureConsumer(consumer.id, { priority: value });
      });
      card.append(title, id, owned, enabled.row, priorityLabel, intercept.row, prevent.row);
      consumers.append(card);
    });
    routes.textContent = keyboard.routeRecords.slice(-25).reverse().map((record) => {
      const path = record.decisions.map((decision) => `${decision.consumerId}:${decision.decision}`).join(' → ') || '无匹配消费者';
      return `#${record.sequence} ${record.phase} ${record.code} [${record.targetKind}]\n${path}${record.interceptedBy ? `\n拦截：${record.interceptedBy}` : ''}`;
    }).join('\n\n') || '尚无键盘路由记录。';
  };

  globalToggle.input.addEventListener('change', () => keyboard.setGlobalEnabled(globalToggle.input.checked));
  clear.addEventListener('click', () => keyboard.clearRouteRecords());
  let renderFrame = 0;
  const requestRender = (): void => {
    // 消费者控件由 render() 重建；编辑过程中不要替换当前获得焦点的输入框。
    if (document.activeElement && consumers.contains(document.activeElement)) return;
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      if (document.activeElement && consumers.contains(document.activeElement)) return;
      render();
    });
  };
  const unsubscribe = keyboard.subscribe(requestRender);
  document.addEventListener('focusin', requestRender);
  const renderAfterConsumerBlur = (): void => { requestAnimationFrame(requestRender); };
  consumers.addEventListener('focusout', renderAfterConsumerBlur);
  render();
  return () => {
    unsubscribe();
    document.removeEventListener('focusin', requestRender);
    consumers.removeEventListener('focusout', renderAfterConsumerBlur);
    if (renderFrame) cancelAnimationFrame(renderFrame);
    panel.root.remove();
  };
};
