import type { LabCommunication } from '../labCommunication';
import type { LabServiceRegistry } from '../labServiceRegistry';
import type { LabUi } from '../labUi';
import type { LabExecutionMonitor } from './LabExecutionMonitor';
import type { SystemRunner } from '@/core/system-runtime/SystemRunner';
import { createSystemDescription } from '../systemManifest';

const formatDuration = (value: number | undefined) => value === undefined ? '—' : value.toFixed(1) + 'ms';

export const createLabExecutionPlanPanel = (
  ui: LabUi,
  monitor: LabExecutionMonitor,
  runner?: SystemRunner,
  services?: LabServiceRegistry,
  communication?: LabCommunication,
): (() => void) => {
  const panel = ui.addPanel('system-lab-execution', '系统装配与运行计划');
  panel.root.classList.add('lab-system-panel');
  const summary = document.createElement('p');
  const explanation = document.createElement('p');
  explanation.textContent = '安装：依赖先于消费者，同层按发现顺序。启动同序，释放逆序。运行任务按阶段和显式 order 排序，与面板顺序无关。Host 基础设施不计入游戏系统。';
  const list = document.createElement('div');
  list.className = 'lab-execution-list';
  const pause = document.createElement('button');
  pause.type = 'button';
  pause.textContent = '暂停模拟';
  pause.disabled = !runner;
  pause.addEventListener('click', () => {
    runner?.setPaused(!runner.isPaused);
    pause.textContent = runner?.isPaused ? '继续模拟' : '暂停模拟';
  });
  panel.content.append(pause);
  const tasks = document.createElement('pre');
  panel.content.append(summary, explanation, list, tasks);
  const render = () => {
    pause.disabled = !runner || !!runner.failure;
    pause.textContent = runner?.failure ? '系统故障，需重新装配' : runner?.isPaused ? '继续模拟' : '暂停模拟';
    const entries = monitor.inspect();
    const systems = monitor.plan.entries.filter(entry => entry.module.manifest?.kind === 'system');
    const ready = systems.filter(system => entries.find(entry => entry.moduleId === system.moduleId)?.status === 'started').length;
    const undeclared = monitor.plan.entries.filter(entry => !entry.module.manifest).length;
    summary.textContent = '游戏系统 ' + ready + '/' + systems.length + ' 已安装（start 完成） · 总模块 ' + entries.length
      + ' · 显式选择 ' + entries.filter(e => e.requested).length
      + ' · 自动依赖 ' + entries.filter(e => !e.requested).length + ' · 未迁移声明 ' + undeclared;
    list.replaceChildren(...entries.map(entry => {
      const module = monitor.plan.entries.find(item => item.moduleId === entry.moduleId)!.module;
      const row = document.createElement('div');
      row.className = 'lab-execution-entry';
      row.dataset.status = entry.status;
      const title = document.createElement('strong');
      title.textContent = (entry.executionIndex + 1) + '. ' + entry.moduleId + ' · ' + (module.manifest?.kind ?? '未声明');
      const badge = document.createElement('span');
      badge.textContent = entry.status;
      const meta = document.createElement('small');
      const consumers = monitor.plan.entries.filter(item => item.dependencies.includes(entry.moduleId)).map(item => item.moduleId);
      meta.textContent = (entry.requested ? '页面声明' : '自动依赖') + ' · 被依赖于 ' + (consumers.join(', ') || '无')
        + ' · depth ' + entry.depth + ' · setup ' + formatDuration(entry.setupDurationMs) + ' · start ' + formatDuration(entry.startDurationMs);
      row.append(title, badge, meta, createSystemDescription(module.id, module.dependencies ?? [], module.manifest));
      const serviceInfo = document.createElement('small');
      serviceInfo.textContent = '实际服务关系：' + (services?.inspect()
        .filter(service => service.owner === entry.moduleId || service.consumers.includes(entry.moduleId))
        .map(service => service.id + ' [所有者 ' + service.owner + ' → ' + (service.consumers.join(', ') || '尚无消费者') + ']')
        .join('；') || '无');
      row.append(serviceInfo);
      const protocols = communication?.inspectBindings();
      const protocolInfo = document.createElement('small');
      protocolInfo.textContent = '实际协议绑定：' + [
        ...(protocols?.requests.filter(binding => binding.owner === entry.moduleId)
          .map(binding => '处理 ' + binding.protocol) ?? []),
        ...(protocols?.events.filter(binding => binding.consumers.includes(entry.moduleId))
          .map(binding => '订阅 ' + binding.protocol) ?? []),
      ].join('；');
      row.append(protocolInfo);
      if (entry.error) {
        const error = document.createElement('small');
        error.className = 'lab-execution-error';
        error.textContent = entry.error;
        row.append(error);
      }
      return row;
    }));
    tasks.textContent = '实际注册的运行任务\n' + (runner?.inspect().map(task =>
      task.phase + ' / ' + task.order + ' · ' + task.owner + '/' + task.id + ' · ' + task.description
      + (task.intervalSeconds ? ' · 最短间隔 ' + task.intervalSeconds + 's' : '')
    ).join('\n') || '无周期任务；事件订阅见系统说明');
  };
  const off = monitor.subscribe(render);
  const offTasks = runner?.subscribe(render);
  const offServices = services?.subscribe(render);
  render();
  return () => { off(); offTasks?.(); offServices?.(); panel.root.remove(); };
};