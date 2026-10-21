import type { CSSProperties } from 'react';
import type { UiReactComponentProps } from '../uiDocument.types';

export function UiDialogueComponent({ node, runtime }: UiReactComponentProps) {
  const p = node.props;
  const content = String(runtime.resolveBinding(node.bindings?.text?.source ?? '', node.bindings?.text?.fallback ?? p.content) ?? '');
  const style: CSSProperties = {
    boxSizing: 'border-box', position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
    background: String(p.fill), color: String(p.textColor), border: `${p.strokeWidth}px solid ${p.stroke}`,
    borderRadius: Number(p.cornerRadius), font: `500 ${p.fontSize}px "Microsoft YaHei",sans-serif`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  if (node.type === 'portrait') return <div style={{ ...style, background: `linear-gradient(${p.accent}, ${p.fill} 70%, #0b1020)` }}>
    <div aria-hidden="true" style={{ position: 'absolute', top: '12%', left: '31%', width: '38%', aspectRatio: '1', borderRadius: '50%', background: '#ffffff1f' }} />
    <div aria-hidden="true" style={{ position: 'absolute', top: '49%', left: '16%', width: '68%', height: '25%', borderRadius: '50% 50% 0 0', background: '#ffffff1f' }} />
    <span style={{ position: 'absolute', top: '40%', transform: 'translateY(-50%)', fontFamily: 'ui-serif, serif', fontWeight: 700 }}>{content || '角'}</span>
  </div>;
  if (node.type === 'dialogue-box') return <div style={{ ...style, display: 'block', padding: '30px 30px 30px 54px' }}>
    <div aria-hidden="true" style={{ position: 'absolute', left: 25, top: 30, bottom: 30, width: 5, background: String(p.accent) }} />
    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5, height: '100%', overflow: 'hidden' }}>{content}</div>
  </div>;
  if (node.type === 'icon') return <div style={style}>
    {p.icon === 'continue' ? <svg viewBox="0 0 48 48" width="100%" height="100%" aria-label="继续"><path d="m18 14 14 10-14 10" fill="none" stroke={String(p.accent)} strokeWidth={Math.max(2, Number(p.strokeWidth))} /></svg>
      : p.icon === 'voice' ? <svg viewBox="0 0 48 48" width="100%" height="100%" aria-label="语音"><path d="M12 19h6l8-8v26l-8-8h-6Z" fill={String(p.accent)} /><path d="M31 15q10 9 0 18" fill="none" stroke={String(p.accent)} strokeWidth="2" /></svg>
        : <span style={{ color: String(p.accent), fontWeight: 700 }}>{content || String(p.icon ?? '').toUpperCase()}</span>}
  </div>;
  return <div style={{ ...style, fontWeight: node.type === 'nameplate' ? 700 : 500, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{content || node.name}</div>;
}

export function UiGroupComponent() { return null; }
