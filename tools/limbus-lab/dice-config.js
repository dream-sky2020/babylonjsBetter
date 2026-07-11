/**
 * 硬币配置管理器
 * 用于实现硬币列表的独立维护与渲染
 */
export class DiceConfigManager {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onUpdate = options.onUpdate || (() => {});
        this.diceTypes = options.diceTypes || [
            { id: 'slash', label: '斩', color: '#ff4d4f' },
            { id: 'pierce', label: '刺', color: '#faad14' },
            { id: 'blunt', label: '打', color: '#1890ff' }
        ];

        this._initStyles();
        this._initAddButton();
    }

    _initStyles() {
        if (!document.getElementById('dice-config-styles')) {
            const style = document.createElement('style');
            style.id = 'dice-config-styles';
            style.textContent = `
                .die-item { display: flex; flex-direction: column; gap: 8px; background: #fff; padding: 12px; border: 1px solid #ddd; border-radius: 6px; border-left: 4px solid #4A90E2; position: relative; margin-bottom: 10px; }
                .die-item .remove-btn { position: absolute; top: 10px; right: 10px; background: #ff4d4f; color: white; border: none; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px; }
                .die-item .remove-btn:hover { background: #d9363e; }
                .add-btn { width: 100%; border: 1px dashed #4A90E2; color: #4A90E2; padding: 8px; background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold; }
                .add-btn:hover { background: #e6f7ff; }
            `;
            document.head.appendChild(style);
        }
    }

    _initAddButton() {
        this.addBtn = document.createElement('button');
        this.addBtn.className = 'add-btn';
        this.addBtn.textContent = '+ 添加一个动作 (硬币)';
        this.addBtn.onclick = () => this.addDie();
        this.container.parentElement.appendChild(this.addBtn);
    }

    addDie(data = {}) {
        const div = document.createElement('div');
        div.className = 'die-item';

        const typesHtml = this.diceTypes.map(t => `
            <label style="margin-right:8px;"><input type="checkbox" value="${t.id}" class="die-type"> ${t.label}</label>
        `).join('');

        div.innerHTML = `
            <button class="remove-btn">删除</button>
            <div class="types-wrapper">${typesHtml}</div>
            <input type="number" class="die-min" value="${data.min || 0}" placeholder="最小值">
            ~
            <input type="number" class="die-max" value="${data.max || 0}" placeholder="最大值">
            <input type="text" class="die-effect" value="${data.effect || ''}" placeholder="效果描述">
        `;

        if (data.type) {
            const types = Array.isArray(data.type) ? data.type : [data.type];
            types.forEach(t => {
                const cb = div.querySelector(`input[value="${t}"]`);
                if (cb) cb.checked = true;
            });
        }

        div.querySelector('.remove-btn').onclick = () => { div.remove(); this.onUpdate(); };
        div.querySelectorAll('input').forEach(i => i.oninput = () => this.onUpdate());

        this.container.appendChild(div);
        this.onUpdate();
    }

    getData() {
        return Array.from(this.container.querySelectorAll('.die-item')).map(item => ({
            type: Array.from(item.querySelectorAll('.die-type:checked')).map(cb => cb.value),
            min: parseInt(item.querySelector('.die-min').value) || 0,
            max: parseInt(item.querySelector('.die-max').value) || 0,
            effect: item.querySelector('.die-effect').value
        }));
    }

    setData(diceArray) {
        this.container.innerHTML = '';
        (diceArray || []).forEach(die => this.addDie(die));
    }
}