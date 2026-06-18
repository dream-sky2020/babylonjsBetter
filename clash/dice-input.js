import { DICE_TAGS } from './dice-tag-config.js';
import './dice-input-effect-input.js';

class DiceInput extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.selectedTags = []; // 存储选中的标签 value

        this.shadowRoot.innerHTML = `
            <style>
                /* 1. 移除 align-items: center，改为 flex-start 确保所有子元素向顶部/左侧对齐 */
                .die-item { 
                    display: flex; 
                    align-items: flex-start; 
                    gap: 8px; 
                    padding: 5px; 
                    border: 1px solid #ccc; 
                    flex-wrap: wrap; /* 如果内容过多，允许换行而不是压缩 */
                }
                
                .tags-container { 
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 4px; 
                    justify-content: flex-start; /* 明确指定内容左对齐 */
                }
                
                .tag-pill { 
                    background: #e0e0e0; 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    font-size: 12px; 
                    display: flex; 
                    align-items: center; 
                }
                
                .remove-tag { margin-left: 4px; cursor: pointer; color: red; }
                
                #modal { 
                    position: absolute; 
                    z-index: 10; 
                    background: white; 
                    border: 1px solid #999; 
                    padding: 10px; 
                    display: none;
                    text-align: left; /* 确保模态框内文字左对齐 */
                }
                
                #effect-list { display: flex; flex-direction: column; align-items: flex-start; }
                
                .grid { 
                    display: grid; 
                    grid-template-columns: repeat(2, 1fr); 
                    gap: 5px; 
                    justify-items: start; /* 确保 Grid 内部格子左对齐 */
                }
            </style>

            <div class="die-item">
                <div class="tags-container" id="display"></div>
                <button id="editBtn">设置标签</button>
                <input type="number" class="min" placeholder="最小" style="width:50px">
                <input type="number" class="max" placeholder="最大" style="width:50px">
                <div id="effect-list"></div>
                <button id="addEffectBtn" style="width: auto; white-space: nowrap; min-width: max-content;">+ 添加效果</button>
                <button class="remove">删除行</button>
            </div>

            <div id="modal">
                <div class="grid" id="grid"></div>
                <button id="confirmBtn" style="margin-top:10px">确认</button>
            </div>
        `;
    }



    toggleModal(show) {
        const modal = this.shadowRoot.querySelector('#modal');
        modal.style.display = show ? 'block' : 'none';
        if (show) this.renderGrid();
    }

    renderGrid() {
        const grid = this.shadowRoot.querySelector('#grid');
        grid.innerHTML = '';
        DICE_TAGS.forEach(tag => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${tag.value}" ${this.selectedTags.includes(tag.value) ? 'checked' : ''}> ${tag.label}`;
            grid.appendChild(label);
        });
    }

    renderTags() {
        const container = this.shadowRoot.querySelector('#display');
        container.innerHTML = '';
        this.selectedTags.forEach(val => {
            const tagData = DICE_TAGS.find(t => t.value === val);
            const span = document.createElement('span');
            span.className = 'tag-pill';
            span.innerHTML = `${tagData.label} <span class="remove-tag" data-val="${val}">×</span>`;
            span.querySelector('.remove-tag').onclick = (e) => {
                this.selectedTags = this.selectedTags.filter(t => t !== val);
                this.renderTags();
            };
            container.appendChild(span);
        });
    }

    // 确认按钮逻辑
    handleConfirm() {
        const checkboxes = this.shadowRoot.querySelectorAll('#grid input:checked');
        this.selectedTags = Array.from(checkboxes).map(cb => cb.value);
        this.renderTags();
        this.toggleModal(false);
    }
    
    connectedCallback() {
        // 1. 初始化渲染已有的标签 pill
        this.renderTags();

        // 2. 绑定“设置标签”按钮
        this.shadowRoot.querySelector('#editBtn').addEventListener('click', () => this.toggleModal(true));

        // 3. 绑定弹窗的“确认”按钮（调用 handleConfirm 收集勾选的标签）
        this.shadowRoot.querySelector('#confirmBtn').addEventListener('click', () => this.handleConfirm());

        // 4. 绑定“删除行”按钮
        this.shadowRoot.querySelector('.remove').addEventListener('click', () => this.remove());

        // 5. 绑定“+ 添加效果”按钮（修复点击无效的问题）
        this.shadowRoot.querySelector('#addEffectBtn').addEventListener('click', () => {
            const effectEl = document.createElement('effect-input');
            this.shadowRoot.querySelector('#effect-list').appendChild(effectEl);
        });
    }

    setValues(data) {
        this.selectedTags = data.tags || [];
        this.renderTags();
        this.shadowRoot.querySelector('.min').value = data.min || 0;
        this.shadowRoot.querySelector('.max').value = data.max || 0;
    }

    getData() {
        // 采集所有动态生成的 effect-input 组件数据
        const effectElements = this.shadowRoot.querySelectorAll('effect-input');
        const effects = Array.from(effectElements).map(el => el.getData());

        return {
            tags: this.selectedTags,
            min: parseInt(this.shadowRoot.querySelector('.min').value) || 0,
            max: parseInt(this.shadowRoot.querySelector('.max').value) || 0,
            effects: effects // 返回数组
        };
    }
}

if (!customElements.get('dice-input')) {
    customElements.define('dice-input', DiceInput);
}