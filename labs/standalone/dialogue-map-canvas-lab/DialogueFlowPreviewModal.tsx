import { useEffect, useRef, useState } from 'react';
import type { DialogueEditorDocument } from '../../../core/dialogue-map/dialogueMap.types';
import { compileDialogueFormula, evaluateDialogueFormula } from '../../../core/dialogue-map/dialogueFormula';
import type { DialogueScalar } from '../../../core/dialogue-map/dialogueMap.types';
import { dialogueTextVariableNames, renderDialogueText } from '../../../core/dialogue-map/dialogueText';
import { chooseDialogueFlowPreview, nextDialogueFlowPreviewLine, previewNode, startDialogueFlowPreview } from './dialogueFlowPreviewState';
import './dialogue-flow-preview.css';

function parseMockValue(raw: string | undefined): DialogueScalar | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  } catch { /* Unquoted text is a string. */ }
  return raw;
}

export function DialogueFlowPreview({ document, startNodeId, onClose }: { document: DialogueEditorDocument; startNodeId: string; onClose(): void }) {
  const [state, setState] = useState(() => startDialogueFlowPreview(document, startNodeId));
  const [mockValues, setMockValues] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  const node = previewNode(document, state);
  const line = node?.kind === 'choice' ? node.lines.get(node.lineOrder[state.lineIndex]) : undefined;
  const lineText = line ? renderDialogueText(line.text, document.textVariables, (_binding, name) => Object.hasOwn(mockValues, name) ? mockValues[name] : undefined) : '';
  const variables = line ? dialogueTextVariableNames(line.text).filter(name => document.textVariables && Object.hasOwn(document.textVariables, name)) : [];
  const moreLines = node?.kind === 'choice' && state.lineIndex + 1 < node.lineOrder.length;
  let formulaVariables: string[] = [], result: boolean | undefined, formulaError = '';
  if (node?.kind === 'condition') {
    try {
      const compiled = compileDialogueFormula(node.formula ?? '', document.textVariables);
      formulaVariables = compiled.variables;
      result = evaluateDialogueFormula(compiled, (_binding, name) => parseMockValue(Object.hasOwn(mockValues, name) ? mockValues[name] : undefined));
    } catch (error) { formulaError = error instanceof Error ? error.message : String(error); }
  }
  const choose = (portId?: string) => setState(current => chooseDialogueFlowPreview(document, current, portId));
  return <div className="dialogue-flow-backdrop">
    <div className="dialogue-flow-modal" role="dialog" aria-modal="true" aria-labelledby="dialogue-flow-title" ref={modalRef} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('button, summary, input, [tabindex="0"]')].filter(item => !item.hasAttribute('disabled'));
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
          <div className="dialogue-flow-speech"><strong>{line?.speaker || (line ? '旁白' : '请选择')}</strong><p>{lineText || (line ? '（空对白）' : '选择接下来的行动。')}</p></div>
          {variables.length ? <fieldset><legend>文本变量模拟值</legend>
            {variables.map(name => <label className="field" key={name}><span>{name}</span><input value={Object.hasOwn(mockValues, name) ? mockValues[name] : ''}
              onChange={event => setMockValues(current => ({ ...current, [name]: event.target.value }))} /></label>)}
          </fieldset> : null}
          <div className="dialogue-flow-options">
            {moreLines ? <button onClick={() => setState(current => nextDialogueFlowPreviewLine(document, current))}>继续阅读 →</button> : node.outputOrder.length ? node.outputOrder.map((id, index) => <button key={id} onClick={() => choose(id)}><span>{String(index + 1).padStart(2, '0')}</span>{node.outputs.get(id)?.label || '继续'}<b>→</b></button>) : <button onClick={() => choose()}>结束对话</button>}
          </div>
        </> : null}
        {node?.kind === 'condition' ? <div className="dialogue-flow-judgment">
          <h3><code>{node.formula || '未设置判断公式'}</code></h3>
          {formulaVariables.map(name => <label className="field" key={name}><span>{name}</span>
            <input placeholder="例如 3、true 或文字" value={Object.hasOwn(mockValues, name) ? mockValues[name] : ''}
              onChange={event => setMockValues(current => ({ ...current, [name]: event.target.value }))} />
          </label>)}
          {formulaError ? <p>{formulaError}</p> : null}
          <div className="dialogue-flow-options"><button disabled={result === undefined} onClick={() =>
            choose(node.outputOrder.find(id => node.outputs.get(id)?.branch === (result ? 'true' : 'false')))}>
            {result === undefined ? '等待公式结果' : result ? '成立 →' : '不成立 →'}
          </button></div>
        </div> : null}
        {node?.kind === 'event' && node.mode === 'wait' ? <div className="dialogue-flow-judgment">
          <h3>等待 {node.events[0].eventType || '未配置事件'}</h3>
          <div className="dialogue-flow-options">
            <button onClick={() => choose(node.outputOrder.find(id => node.outputs.get(id)?.branch === 'next'))}>模拟收到事件</button>
            {node.wait.timeoutMs === undefined ? null : <button onClick={() => choose(node.outputOrder.find(id => node.outputs.get(id)?.branch === 'timeout'))}>模拟超时</button>}
          </div>
        </div> : null}
      </div>
      <footer className="dialogue-flow-footer"><span>模拟预览 · Esc 关闭</span>{state.events.length ? <details><summary>事件与动作记录（{state.events.length}）</summary><ul>{state.events.map((event, index) => <li key={index}>{event}</li>)}</ul></details> : null}</footer>
    </div>
  </div>;
}
