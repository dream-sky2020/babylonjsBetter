import { DEFAULT_LAB_WORKSPACE, normalizeLabWorkspace, type LabWorkspace } from './labWorkspace';

/** Owns layout preferences only. Modules retain their existing DOM and state. */
export class LabWorkbench {
  readonly layout = document.createElement('div');
  readonly stage = document.createElement('main');
  readonly canvas = document.createElement('canvas');
  readonly objects = document.createElement('aside');
  readonly panels = document.createElement('div');
  readonly diagnostics = document.createElement('div');
  readonly status = document.createElement('div');
  readonly header = document.createElement('header');
  private readonly controls = document.createElement('aside');
  private readonly key = `babylonjsBetter:lab-workspace:${location.pathname}:v1`;
  private state: LabWorkspace;
  private cleanup: (() => void)[] = [];
  private onResize = () => {};
  constructor(root: HTMLElement, title: string, description: string) {
    let saved: Partial<LabWorkspace> | null = null;
    try { saved = JSON.parse(localStorage.getItem(this.key) ?? 'null'); } catch { /* Use defaults. */ }
    this.state = normalizeLabWorkspace(saved);
    this.header.className = 'lab-workbench-header';
    const heading = document.createElement('h1'); heading.textContent = title; heading.title = description;
    this.status.className = 'lab-global-status'; this.status.textContent = '正在初始化…';
    const objectToggle = this.button('对象树', () => this.change({ objectsOpen: !this.state.objectsOpen })); objectToggle.dataset.labToggle = 'objects';
    const controlToggle = this.button('操作面板', () => this.change({ controlsOpen: !this.state.controlsOpen })); controlToggle.dataset.labToggle = 'controls';
    const reset = this.button('恢复布局', () => this.change({ ...DEFAULT_LAB_WORKSPACE })); reset.dataset.labLayoutReset = '';
    this.header.append(heading, this.status, objectToggle, controlToggle, reset);
    this.layout.className = 'lab-layout lab-workbench-layout';
    this.objects.className = 'lab-object-browser'; this.objects.setAttribute('aria-label', '对象树');
    this.stage.className = 'lab-viewport'; this.canvas.className = 'lab-babylon-canvas'; this.stage.append(this.canvas);
    this.controls.className = 'lab-controls'; this.controls.setAttribute('aria-label', '操作面板');
    const tabs = document.createElement('nav'); tabs.className = 'lab-controls-tabs'; tabs.setAttribute('aria-label', '操作面板分类');
    const modules = this.button('模块操作', () => this.change({ tab: 'modules' })); modules.dataset.labTab = 'modules';
    const diagnostics = this.button('系统诊断', () => this.change({ tab: 'diagnostics' })); diagnostics.dataset.labTab = 'diagnostics';
    tabs.append(modules, diagnostics);
    this.panels.className = 'lab-panels lab-control-scroll'; this.diagnostics.className = 'lab-diagnostics lab-control-scroll';
    this.controls.append(tabs, this.panels, this.diagnostics);
    this.layout.append(this.objects, this.splitter('left'), this.stage, this.splitter('right'), this.controls);
    root.replaceChildren(this.header, this.layout);
    this.apply();
    const observer = new ResizeObserver(() => { this.apply(); this.onResize(); }); observer.observe(this.layout);
    this.cleanup.push(() => observer.disconnect());
  }
  private button(label: string, action: () => void) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', action); return button; }
  connectResize(callback: () => void) { this.onResize = callback; callback(); }
  showDiagnostics() { this.change({ tab: 'diagnostics', controlsOpen: true }); }
  showModules() { this.change({ tab: 'modules', controlsOpen: true }); }
  private change(patch: Partial<LabWorkspace>) {
    this.state = normalizeLabWorkspace({ ...this.state, ...patch });
    try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch { /* Keep session preferences. */ }
    this.apply(); this.onResize();
  }
  private apply() {
    const width = this.layout.clientWidth || window.innerWidth;
    const right = this.state.controlsOpen ? Math.min(this.state.rightWidth, Math.max(260, width * .43)) : 0;
    const left = this.state.objectsOpen ? Math.min(this.state.leftWidth, Math.max(180, width - right - 300)) : 0;
    this.layout.style.gridTemplateColumns = `${left}px ${left ? 5 : 0}px minmax(0, 1fr) ${right ? 5 : 0}px ${right}px`;
    this.objects.hidden = !this.state.objectsOpen; this.controls.hidden = !this.state.controlsOpen;
    this.panels.hidden = this.state.tab !== 'modules'; this.diagnostics.hidden = this.state.tab !== 'diagnostics';
    this.layout.dataset.leftOpen = String(this.state.objectsOpen); this.layout.dataset.rightOpen = String(this.state.controlsOpen);
    this.header.querySelector('[data-lab-toggle="objects"]')?.setAttribute('aria-pressed', String(this.state.objectsOpen));
    this.header.querySelector('[data-lab-toggle="controls"]')?.setAttribute('aria-pressed', String(this.state.controlsOpen));
    this.controls.querySelectorAll<HTMLElement>('[data-lab-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.labTab === this.state.tab)));
  }
  private splitter(side: 'left' | 'right') {
    const el = document.createElement('div'); el.className = `lab-workbench-splitter ${side}`; el.dataset.labSplitter = side;
    el.setAttribute('role', 'separator'); el.setAttribute('aria-label', side === 'left' ? '调整对象树宽度' : '调整操作面板宽度');
    el.setAttribute('aria-orientation', 'vertical'); el.tabIndex = 0;
    const field = side === 'left' ? 'leftWidth' : 'rightWidth';
    el.addEventListener('pointerdown', event => { if (event.button === 0) { el.setPointerCapture(event.pointerId); event.preventDefault(); } });
    el.addEventListener('pointermove', event => {
      if (!el.hasPointerCapture(event.pointerId)) return;
      const rect = this.layout.getBoundingClientRect(); this.change({ [field]: side === 'left' ? event.clientX - rect.left : rect.right - event.clientX });
    });
    const release = (event: PointerEvent) => { if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId); };
    el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);
    el.addEventListener('dblclick', () => this.change({ [field]: DEFAULT_LAB_WORKSPACE[field] }));
    el.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); const step = (event.key === 'ArrowLeft' ? -20 : 20) * (side === 'left' ? 1 : -1);
      this.change({ [field]: this.state[field] + step });
    });
    return el;
  }
  dispose() { this.onResize = () => {}; this.cleanup.forEach(dispose => dispose()); this.cleanup.length = 0; }
}
