import { useState } from 'react';
import { DIALOGUE_NODE_WHITESPACE_DEFAULTS, type DialogueEditorNode, type DialogueNodeDisplay, type DialogueNodeWhitespace } from '../../core/dialogue-map/dialogueMap.types.ts';
import type { DialogueArrange } from './dialogueGraphEditing.ts';

const whitespaceLabels: Record<keyof DialogueNodeWhitespace, string> = { header: '标题留白', content: '内容行留白', outputs: '出口行留白', top: '顶部留白', sections: '内容与出口间距', bottom: '底部留白', height: '设定高度额外留白' };
export function DialogueMultiSelectionInspector({ nodes, onPatch, onArrange, onFocus, onCopy, onDelete }: {
  nodes: DialogueEditorNode[]; onPatch(patch: Partial<DialogueNodeDisplay>): void; onArrange(mode: DialogueArrange): void; onFocus(): void; onCopy(): void; onDelete(): void;
}) {
  const [editing, setEditing] = useState(false);
  const mixed = <T,>(read: (node: DialogueEditorNode) => T): T | '' => nodes.every(node => read(node) === read(nodes[0])) ? read(nodes[0]) : '';
  return <section className="dialogue-multi-inspector">
    <strong>已选 {nodes.length} 个节点</strong><p>当前属性面板编辑单个节点；通过下方按钮进入批量编辑。</p>
    <div className="collection-actions"><button onClick={onFocus}>聚焦选区</button><button onClick={onCopy}>复制选区</button><button onClick={onDelete}>删除选区</button><button aria-expanded={editing} onClick={() => setEditing(value => !value)}>批量编辑属性</button></div>
    {editing ? <div className="dialogue-bulk-fields">
      <label className="field"><span>颜色</span><select aria-label="批量颜色" value={mixed(node => node.display.colorToken)} onChange={event => { if (event.target.value) onPatch({ colorToken: event.target.value }); }}>
        <option value="" disabled>混合</option>{['blue-muted', 'violet-muted', 'red-muted', 'green-muted', 'gray-muted'].map(value => <option key={value}>{value}</option>)}
      </select></label>
      {(['widthUnits', 'heightUnits'] as const).map(key => <label className="field" key={key}><span>{key === 'widthUnits' ? '宽度（格）' : '设定高度（格）'}</span>
        <input aria-label={key === 'widthUnits' ? '批量宽度' : '批量高度'} type="number" min={key === 'widthUnits' ? 4 : 3} max={40} value={mixed(node => node.display[key])} placeholder="混合" onChange={event => { const value = Number(event.target.value); if (event.target.value && Number.isInteger(value) && value >= (key === 'widthUnits' ? 4 : 3) && value <= 40) onPatch({ [key]: value }); }} />
      </label>)}
      {(Object.keys(DIALOGUE_NODE_WHITESPACE_DEFAULTS) as Array<keyof DialogueNodeWhitespace>).map(key => {
        const current = mixed(node => node.display.whitespace?.[key] ?? true);
        return <label className="field" key={key}><span>{whitespaceLabels[key]}</span><select aria-label={`批量${whitespaceLabels[key]}`} value={current === '' ? '' : String(current)} onChange={event => { if (event.target.value) onPatch({ whitespace: { [key]: event.target.value === 'true' } }); }}><option value="" disabled>混合</option><option value="true">保留</option><option value="false">收紧</option></select></label>;
      })}
      <small>只修改刚操作的字段，其他属性保持各自的值。</small>
    </div> : null}
    <div className="dialogue-arrange-actions">{([['left', '左对齐'], ['right', '右对齐'], ['top', '顶对齐'], ['bottom', '底对齐'], ['horizontal', '水平等间距'], ['vertical', '垂直等间距']] as const).map(([mode, label]) => <button key={mode} disabled={nodes.length < (mode === 'horizontal' || mode === 'vertical' ? 3 : 2)} onClick={() => onArrange(mode)}>{label}</button>)}</div>
  </section>;
}
