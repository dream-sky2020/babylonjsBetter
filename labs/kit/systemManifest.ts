export type LabSystemManifest = Readonly<{
  kind: 'system' | 'debug' | 'configuration' | 'compatibility';
  responsibility: string;
  core: readonly Readonly<{ path: string; symbols: string; purpose: string; loadSource?: () => Promise<string> }>[];
  services: readonly string[];
  protocols: readonly string[];
  scheduling: string;
}>;

/** Render declarations, never inspect another module's private DOM or runtime. */
export function createSystemDescription(id: string, dependencies: readonly string[], manifest?: LabSystemManifest): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'lab-system-description';
  const summary = document.createElement('summary');
  summary.textContent = `系统说明 · ${id}`;
  details.append(summary);
  const line = (label: string, value: string) => {
    const p = document.createElement('p');
    p.textContent = `${label}：${value}`;
    details.append(p);
  };
  line('直接依赖', dependencies.join(' → ') || '无');
  if (!manifest) { line('迁移状态', '尚未声明系统契约，不计入已声明游戏系统'); return details; }
  line('职责', manifest.responsibility);
  manifest.core.forEach(ref => {
    line('Core', ref.path + ' · ' + ref.symbols + ' — ' + ref.purpose);
    if (!ref.loadSource) return;
    const sourceDetails = document.createElement('details');
    const sourceSummary = document.createElement('summary');
    sourceSummary.textContent = '查看源码：' + ref.path;
    const source = document.createElement('pre');
    source.className = 'lab-system-source';
    let loaded = false;
    sourceDetails.addEventListener('toggle', () => {
      if (!sourceDetails.open || loaded) return;
      loaded = true;
      source.textContent = '正在读取源码…';
      void ref.loadSource!().then(text => { source.textContent = text; }).catch(error => {
        loaded = false;
        source.textContent = error instanceof Error ? error.message : String(error);
      });
    });
    sourceDetails.append(sourceSummary, source);
    details.append(sourceDetails);
  });
  line('服务', manifest.services.join('；') || '无');
  line('协议', manifest.protocols.join('；') || '无');
  line('调度', manifest.scheduling);
  return details;
}
