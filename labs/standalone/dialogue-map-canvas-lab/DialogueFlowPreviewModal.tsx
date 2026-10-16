import { useEffect, useRef, useState } from 'react';
import type { DialogueEditorDocument } from '../../../core/dialogue-map/dialogueMap.types';
import { summarizeDialogueCondition } from '../../../core/dialogue-map/dialogueRules';
import { chooseDialogueFlowPreview, nextDialogueFlowPreviewLine, previewNode, startDialogueFlowPreview } from './dialogueFlowPreviewState';
import './dialogue-flow-preview.css';

export function DialogueFlowPreview({ document, startNodeId, onClose }: { document: DialogueEditorDocument; startNodeId: string; onClose(): void }) {
  const [state, setState] = useState(() => startDialogueFlowPreview(document, startNodeId));
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  const node = previewNode(document, state);
  const line = node?.kind === 'choice' ? node.lines.get(node.lineOrder[state.lineIndex]) : undefined;
  const moreLines = node?.kind === 'choice' && state.lineIndex + 1 < node.lineOrder.length;
  const conditions = node?.kind === 'condition' && node.condition ? node.condition.type === 'compare' ? [node.condition] : node.condition.conditions : [];
  const choose = (portId?: string) => setState(current => chooseDialogueFlowPreview(document, current, portId));
  return <div className="dialogue-flow-backdrop">
    <div className="dialogue-flow-modal" role="dialog" aria-modal="true" aria-labelledby="dialogue-flow-title" ref={modalRef} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('button, summary, [tabindex="0"]')].filter(item => !item.hasAttribute('disabled'));
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header className="dialogue-flow-header">
        <div><small>流程预览</small><h2 id="dialogue-flow-title">{node?.title ?? document.name}</h2></div>
        <button className="dialogue-flow-close" aria-label="关闭预览" onClick={onClose}>×</button>
      </header>
      <div className="dialogue-flow-scene"><span>从选中卡片出发，探索对话的每个分支</span></div>
      <div className="dialogue-flow-content" aria-live="polite">
        {state.ended ? <div className="dialogue-flow-ending"><h3>预览结束</h3><p>{state.ended}</p><button onClick={() => setState(startDialogueFlowPreview(document, startNodeId))}>重新预览</button></div> : null}
        {node?.kind === 'choice' ? <>
          <div className="dialogue-flow-speech"><strong>{line?.speaker || (line ? '旁白' : '请选择')}</strong><p>{line?.text || (line ? '（空对白）' : '选择接下来的行动。')}</p></div>
          <div className="dialogue-flow-options">
            {moreLines ? <button onClick={() => setState(current => nextDialogueFlowPreviewLine(document, current))}>继续阅读 →</button> : node.outputOrder.length ? node.outputOrder.map((id, index) => <button key={id} onClick={() => choose(id)}><span>{String(index + 1).padStart(2, '0')}</span>{node.outputs.get(id)?.label || '继续'}<b>→</b></button>) : <button onClick={() => choose()}>结束对话</button>}
          </div>
        </> : null}
        {node?.kind === 'condition' ? <div className="dialogue-flow-judgment"><small>手动模拟判断</small><h3>{node.condition?.type === 'any' ? '任一满足' : '全部满足'}</h3>
          {conditions.length ? <ul>{conditions.map((condition, index) => <li key={index}>{summarizeDialogueCondition(condition)}</li>)}</ul> : <p>尚未配置条件，也可以手动选择分支。</p>}
          <div className="dialogue-flow-options"><button onClick={() => choose(node.outputOrder.find(id => node.outputs.get(id)?.branch === 'true'))}>通过 →</button><button onClick={() => choose(node.outputOrder.find(id => node.outputs.get(id)?.branch === 'false'))}>不通过 →</button></div>
        </div> : null}
      </div>
      <footer className="dialogue-flow-footer"><span>等待事件自动放行 · 事件仅模拟 · Esc 关闭</span>{state.events.length ? <details><summary>事件记录（{state.events.length}）</summary><ul>{state.events.map((event, index) => <li key={index}>{event}</li>)}</ul></details> : null}</footer>
    </div>
  </div>;
}
