import { useContext } from 'react';
import { DialoguePropertyClipboardContext } from './dialoguePropertyClipboardContext';
import type { DialoguePropertyTarget } from './dialoguePropertyEditing.ts';



export function DialoguePropertyActions({ target }: { target: DialoguePropertyTarget }) {
  const context = useContext(DialoguePropertyClipboardContext);
  if (!context) return null;
  const reason = context.reason(target), appendReason = context.reason(target, true);
  const replaceLabels: Partial<Record<DialoguePropertyTarget['scope'], string>> = { lines: '替换对白集合', outputs: '替换现有选项文本', conditions: '替换条件集合', events: '替换事件集合' };
  const appendLabels: Partial<Record<DialoguePropertyTarget['scope'], string>> = { lines: '追加对白', outputs: '追加为新选项', conditions: '追加条件', events: '追加事件' };
  return <div className="property-clipboard-actions" aria-label="属性复制粘贴">
    <button onClick={() => context.copy(target)}>复制属性</button>
    <button disabled={!!reason} title={reason ?? '仅替换本面板的属性，保留位置、ID 和连线'} onClick={() => context.paste(target)}>{replaceLabels[target.scope] ?? '粘贴属性'}</button>
    {appendLabels[target.scope] ? <button disabled={!!appendReason} title={appendReason ?? '追加内容，保留已有内容和连接'} onClick={() => context.paste(target, true)}>{appendLabels[target.scope]}</button> : null}
    {context.clipboard && reason ? <small>{reason}</small> : null}
  </div>;
}
