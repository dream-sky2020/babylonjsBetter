// status-input.ts
import { STATUS_TYPES } from '../config.ts';
import type { StatusConfig } from '../types.ts';

// 统一使用的 Shadow DOM 元素查找工具函数
function queryInShadow<T extends Element>(root: ShadowRoot, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element as T;
}

export class StatusInputElement extends HTMLElement {
  // 1. 移除 constructor，改用 connectedCallback
  connectedCallback(): void {
    this.attachShadow({ mode: 'open' }); // 2. 开启 Shadow DOM
    this.render();
  }

  private render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    // 3. 将 HTML 结构写入 Shadow DOM，并自带隔离的样式
    root.innerHTML = `
      <style>
        .status-item-container {
          display: flex;
          gap: 5px;
          align-items: center;
          margin: 4px 0;
          font-size: 14px;
        }
        select, input {
          padding: 4px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          padding: 4px 8px;
          cursor: pointer;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
        }
        button:hover { background: #c0392b; }
      </style>
      <div class="status-item-container">
        <select class="status-type"></select>
        <span>层数</span>
        <input type="number" class="status-stack" value="1" min="0" style="width: 50px;">
        <span>强度</span>
        <input type="number" class="status-power" value="1" min="0" style="width: 50px;">
        <button type="button" class="remove-status">删</button>
      </div>
    `;

    // 绑定 DOM 节点并填充选项
    const typeSelect = queryInShadow<HTMLSelectElement>(root, '.status-type');
    const removeBtn = queryInShadow<HTMLButtonElement>(root, '.remove-status');

    typeSelect.innerHTML = STATUS_TYPES.map(
      (status) => `<option value="${status.id}">${status.label}</option>`
    ).join('');

    // 绑定删除事件
    removeBtn.addEventListener('click', () => {
      this.remove(); // 直接移除当前组件
    });
  }

  // 接收数据并更新 UI
  public setValues(data: Partial<StatusConfig>): void {
    const root = this.shadowRoot;
    if (!root) return;

    const typeSelect = queryInShadow<HTMLSelectElement>(root, '.status-type');
    const stackInput = queryInShadow<HTMLInputElement>(root, '.status-stack');
    const powerInput = queryInShadow<HTMLInputElement>(root, '.status-power');

    if (data.type && STATUS_TYPES.some((s) => s.id === data.type)) {
      typeSelect.value = data.type;
    } else if (STATUS_TYPES.length > 0) {
      typeSelect.value = STATUS_TYPES[0].id;
    }

    if (data.stack !== undefined) {
      stackInput.value = String(data.stack);
    }
    if (data.power !== undefined) {
      powerInput.value = String(data.power);
    }
  }

  // 读取 UI 数据返回配置对象
  public getData(): StatusConfig {
    const root = this.shadowRoot;
    if (!root) return { type: '', stack: 0, power: 0 };

    const typeSelect = queryInShadow<HTMLSelectElement>(root, '.status-type');
    const stackInput = queryInShadow<HTMLInputElement>(root, '.status-stack');
    const powerInput = queryInShadow<HTMLInputElement>(root, '.status-power');

    return {
      type: typeSelect.value,
      stack: Number.parseInt(stackInput.value, 10) || 0,
      power: Number.parseInt(powerInput.value, 10) || 0,
    };
  }
}

// 注册 Web Component
customElements.define('status-input', StatusInputElement);