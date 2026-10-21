import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { UiDefinitionRegistry } from '../core/ui-document/uiDefinition.registry';
import { parseUiDocument, cloneUiDocument } from '../core/ui-document/uiDocument';
import { UiDocumentView, type UiReactComponentProps } from '../core/ui-document/UiDocumentView';
import { registerReactUiComponent } from '../core/ui-document/react/uiReactDefinitions';

// This is a manual mount/unmount verification fixture, not a Fast Refresh boundary.
// eslint-disable-next-line react-refresh/only-export-components
function RegisteredCounter({ node }: UiReactComponentProps) {
  const [count, setCount] = useState(0);
  return <button data-react-only-widget onClick={() => setCount(value => value + 1)}>{String(node.props.content)} · {count}</button>;
}

/** Invoked by the browser verifier, never by the Lab. Verifies the public registration contract. */
export function runReactOnlyComponentVerification() {
  const registry = new UiDefinitionRegistry();
  registerReactUiComponent(registry, {
    type: 'test.react-only', version: 1, label: '纯 React 测试组件', category: '验证', component: RegisteredCounter,
    defaultSize: { width: 160, height: 44 }, fields: [{ path: 'content', label: '文字', control: 'text' }],
    createDefaultProps: () => ({ content: '注册组件' }),
    normalizeProps: raw => ({ content: String((raw as Record<string, unknown>)?.content ?? '注册组件') }),
  });
  const document = parseUiDocument({ schemaVersion: 2, presetKey: 'verification', name: 'verification', canvas: { width: 400, height: 240 }, rootIds: ['widget'], nodes: {
    widget: { id: 'widget', type: 'test.react-only', layout: { mode: 'absolute', x: 20, y: 30, width: 160, height: 44 }, props: registry.require('test.react-only').createDefaultProps() },
  } });
  const container = window.document.createElement('div'); container.style.cssText = 'position:fixed;left:-10000px;top:0;'; window.document.body.append(container);
  const root = createRoot(container);
  try {
    flushSync(() => root.render(<UiDocumentView document={document} registry={registry} />));
    const button = container.querySelector<HTMLButtonElement>('[data-react-only-widget]')!;
    flushSync(() => button.click());
    const draft = cloneUiDocument(document); draft.nodes.widget.props.content = '已修改';
    if (draft.nodes.widget.layout.mode === 'absolute') draft.nodes.widget.layout.x = 60;
    flushSync(() => root.render(<UiDocumentView document={draft} registry={registry} mode="edit" />));
    const results = {
      noCanvasAdapter: registry.require('test.react-only').render === undefined,
      metadata: registry.require('test.react-only').fields[0].path === 'content',
      nativeComponent: container.querySelector('[data-react-only-widget]') === button,
      stateAndProps: button.textContent === '已修改 · 1',
      layout: container.querySelector<HTMLElement>('[data-ui-node="widget"]')?.style.left === '60px',
      serialization: parseUiDocument(JSON.parse(JSON.stringify(draft))).nodes.widget.props.content === '已修改',
      noCanvas: container.querySelectorAll('canvas').length === 0,
    };
    if (!Object.values(results).every(Boolean)) throw new Error(JSON.stringify(results));
    let legacyDrawCalls = 0;
    registry.register({ type: 'test.legacy-only', version: 1, label: '旧定义', category: '验证', defaultSize: { width: 160, height: 44 }, fields: [], createDefaultProps: () => ({}), normalizeProps: () => ({}), render: () => { legacyDrawCalls++; } });
    const missing = cloneUiDocument(document); missing.nodes.widget.type = 'test.legacy-only';
    flushSync(() => root.render(<UiDocumentView document={missing} registry={registry} />));
    const noFallback = legacyDrawCalls === 0 && Boolean(container.querySelector('[data-ui-missing="test.legacy-only"]')) && container.querySelectorAll('canvas').length === 0;
    if (!noFallback) throw new Error('React host fell back to a legacy drawing adapter');
    return { ...results, missingReactPlaceholder: true, noDrawingFallback: true };
  } finally { flushSync(() => root.unmount()); container.remove(); }
}
