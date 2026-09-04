import type { LabUi } from '../labUi';
import type { LabExecutionMonitor } from './LabExecutionMonitor';

const formatDuration = (value: number | undefined) => value === undefined ? '—' : `${value.toFixed(1)}ms`;

export const createLabExecutionPlanPanel = (
  ui: LabUi,
  monitor: LabExecutionMonitor,
): (() => void) => {
  const panel = ui.addPanel('system-lab-execution', 'Lab Execution');
  panel.root.classList.add('lab-system-panel');
  const list = document.createElement('div');
  list.className = 'lab-execution-list';
  panel.content.append(list);

  const render = () => {
    list.replaceChildren(...monitor.inspect().map((entry) => {
      const row = document.createElement('div');
      row.className = 'lab-execution-entry';
      row.dataset.status = entry.status;
      const title = document.createElement('strong');
      title.textContent = `${entry.executionIndex}. ${entry.moduleId}`;
      const badge = document.createElement('span');
      badge.textContent = entry.status;
      const meta = document.createElement('small');
      const source = entry.requested ? '页面声明' : '自动依赖';
      const dependencies = entry.dependencies.length ? entry.dependencies.join(', ') : '无';
      meta.textContent = `depth ${entry.depth} · ${source} · setup ${formatDuration(entry.setupDurationMs)} · start ${formatDuration(entry.startDurationMs)} · dependencies: ${dependencies}`;
      row.append(title, badge, meta);
      if (entry.error) {
        const error = document.createElement('small');
        error.className = 'lab-execution-error';
        error.textContent = entry.error;
        row.append(error);
      }
      return row;
    }));
  };
  const off = monitor.subscribe(render);
  render();
  return () => {
    off();
    panel.root.remove();
  };
};
