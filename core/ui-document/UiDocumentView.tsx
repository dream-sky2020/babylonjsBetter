import React, { type ComponentType, type CSSProperties } from 'react';
import type { UiDefinitionRegistry } from './uiDefinition.registry.ts';
import { resolveUiNodeLayout } from './uiDocument.layout.ts';
import type { UiDocument, UiRenderRuntime, UiReactComponentProps } from './uiDocument.types.ts';

export type { UiReactComponentProps } from './uiDocument.types.ts';
export type UiReactComponents = Record<string, ComponentType<UiReactComponentProps>>;

/** The same React tree renders in edit, preview, and game hosts. Never falls back to bitmap drawing. */
export const UiDocumentView = ({ document, registry, components = uiBasicReactComponents, onAction, style, mode = 'runtime' }: {
  document: UiDocument;
  registry: UiDefinitionRegistry;
  components?: UiReactComponents;
  onAction?: (action: string) => void;
  style?: CSSProperties;
  mode?: UiRenderRuntime['mode'];
}) => {
  const [, requestRender] = React.useReducer(value => value + 1, 0);
  const runtime: UiRenderRuntime = {
    mode, assets: { getImage: () => undefined }, requestRender,
    resolveBinding: (path, fallback) => document.previewContext?.[path] ?? fallback,
  };
  const ordered = (ids: string[]) => [...ids].sort((a, b) => document.nodes[a].layout.zIndex - document.nodes[b].layout.zIndex);
  const renderNode = (id: string, parentX = 0, parentY = 0): React.ReactNode => {
    const node = resolveUiNodeLayout(document, id); if (!node?.visible) return null;
    const source = document.nodes[id]; const { x, y, width, height, zIndex } = node.layout;
    const definition = registry.get(node.type);
    const componentNode = definition ? { ...node, props: definition.normalizeProps(node.props) } : node;
    const Component = definition?.component ?? components[node.type];
    return <div key={id} data-ui-node={id} style={{ position: 'absolute', left: x - parentX, top: y - parentY, width, height, zIndex, opacity: source.opacity, isolation: 'isolate', pointerEvents: 'none' }}>
      <div data-ui-visual={id} style={{ position: 'absolute', inset: 0, pointerEvents: node.type === 'group' ? 'none' : 'auto' }}>
        {Component ? <Component node={componentNode} runtime={runtime} onAction={mode === 'edit' ? undefined : onAction} /> : <div data-ui-missing={node.type} style={{ width: '100%', height: '100%', padding: 8, overflow: 'hidden', color: '#fecaca', border: '1px dashed #f87171', background: '#7f1d1d' }}>未注册 React 组件：{node.type}</div>}
      </div>
      {ordered(source.childIds).map(childId => renderNode(childId, x, y))}
    </div>;
  };
  return <div data-ui-document={document.presetKey} style={{ position: 'relative', flexShrink: 0, width: document.canvas.width, height: document.canvas.height, overflow: 'hidden', background: `linear-gradient(${document.canvas.backgroundTop}, ${document.canvas.backgroundBottom})`, ...style }}>
    {ordered(document.rootIds).map(id => renderNode(id))}
  </div>;
};

const BasicUiComponent = ({ node, runtime, onAction }: UiReactComponentProps) => {
  const p = node.props;
  const bound = (key: string, fallback: unknown) => runtime.resolveBinding(node.bindings?.[key]?.source ?? '', node.bindings?.[key]?.fallback ?? fallback);
  const content = String(bound('text', p.content ?? ''));
  const style: CSSProperties = {
    boxSizing: 'border-box', width: '100%', height: '100%', margin: 0,
    background: node.type === 'label' ? 'transparent' : String(bound('fill', p.fill)),
    color: String(p.textColor), border: node.type === 'label' ? 'none' : `${Number(p.strokeWidth)}px solid ${p.stroke}`,
    borderRadius: Number(p.cornerRadius), font: `${node.type === 'button' ? 600 : 500} ${Number(p.fontSize)}px "Microsoft YaHei",sans-serif`,
    display: 'flex', alignItems: 'center', justifyContent: node.type === 'button' ? 'center' : 'space-between', padding: node.type === 'resource-bar' ? '0 12px 8px' : '0 4px',
    position: 'relative', overflow: 'hidden', cursor: node.type === 'button' ? 'pointer' : undefined,
  };
  if (node.type === 'button') return <button type="button" style={style} onClick={event => { event.stopPropagation(); onAction?.(String(bound('action', p.action ?? ''))); }}>{content}</button>;
  if (node.type === 'panel') return <div style={style} />;
  if (node.type === 'resource-bar') {
    const value = Number(bound('value', p.value)); const maximum = Number(bound('maximum', p.maximum));
    const ratio = Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
    return <div style={style} role="progressbar" aria-label={content} aria-valuemin={0} aria-valuemax={Number.isFinite(maximum) ? Math.max(0, maximum) : 0} aria-valuenow={Number.isFinite(value) ? Math.max(0, Math.min(value, maximum || 0)) : 0}>
      <span>{content}</span><span>{Number.isFinite(value) ? value : 0} / {Number.isFinite(maximum) ? maximum : 0}</span>
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 8, width: `${ratio * 100}%`, background: String(p.accent) }} />
    </div>;
  }
  return <div style={style}>{content}</div>;
};

// This registry is the public default component configuration, shared with custom hosts.
// eslint-disable-next-line react-refresh/only-export-components
export const uiBasicReactComponents: UiReactComponents = Object.fromEntries(['panel', 'label', 'button', 'resource-bar'].map(type => [type, BasicUiComponent]));
