export type LabPanel = {
  root: HTMLDivElement;
  content: HTMLDivElement;
};

export class LabUi {
  constructor(
    readonly sidebar: HTMLElement,
    readonly status: HTMLDivElement,
  ) {}

  addPanel(id: string, title: string): LabPanel {
    if (this.sidebar.querySelector(`[data-lab-panel="${id}"]`)) {
      throw new Error(`Lab 面板 ID 重复：“${id}”。`);
    }
    const root = document.createElement('section');
    root.className = 'lab-card';
    root.dataset.labPanel = id;
    const header = document.createElement('div');
    header.className = 'lab-card-header';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'lab-card-collapse';
    collapseButton.setAttribute('aria-label', `收起“${title}”面板`);
    collapseButton.setAttribute('aria-expanded', 'true');
    collapseButton.title = '收起';
    collapseButton.textContent = '−';
    const content = document.createElement('div');
    content.className = 'lab-panel-content';
    const contentId = `lab-panel-content-${id}`;
    content.id = contentId;
    collapseButton.setAttribute('aria-controls', contentId);
    collapseButton.addEventListener('click', () => {
      const collapsed = root.classList.toggle('is-collapsed');
      content.hidden = collapsed;
      collapseButton.textContent = collapsed ? '+' : '−';
      collapseButton.title = collapsed ? '展开' : '收起';
      collapseButton.setAttribute('aria-expanded', String(!collapsed));
      collapseButton.setAttribute('aria-label', `${collapsed ? '展开' : '收起'}“${title}”面板`);
    });
    header.append(heading, collapseButton);
    root.append(header, content);
    this.sidebar.append(root);
    return { root, content };
  }

  setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.dataset.error = String(error);
  }
}

export const createLabField = (labelText: string, control: HTMLElement): HTMLLabelElement => {
  const label = document.createElement('label');
  label.className = 'lab-field';
  const text = document.createElement('span');
  text.textContent = labelText;
  label.append(text, control);
  return label;
};

export const createLabSwitch = (
  labelText: string,
  checked = false,
): { row: HTMLLabelElement; input: HTMLInputElement } => {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  const row = createLabField(labelText, input);
  row.classList.add('lab-switch');
  return { row, input };
};

export const createLabJson = (initialText = '尚未加载'): HTMLPreElement => {
  const element = document.createElement('pre');
  element.className = 'lab-json';
  element.textContent = initialText;
  return element;
};

export const createLabStatus = (initialText: string): HTMLDivElement => {
  const element = document.createElement('div');
  element.className = 'lab-inline-status';
  element.textContent = initialText;
  return element;
};
