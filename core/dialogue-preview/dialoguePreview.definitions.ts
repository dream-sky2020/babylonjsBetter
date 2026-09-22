import { UiDefinitionRegistry, type UiDefinition, type UiNode, type UiRenderRuntime } from '../ui-document';

type VisualProps = Record<string, unknown> & {
  content: string; fill: string; stroke: string; textColor: string; accent: string;
  strokeWidth: number; cornerRadius: number; fontSize: number; icon?: string;
};

const DEFAULT_PROPS: VisualProps = { content: '', fill: '#121a2d', stroke: '#7dd3fc', textColor: '#f8fafc', accent: '#f5c96a', strokeWidth: 3, cornerRadius: 20, fontSize: 30 };
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback;
const num = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const normalize = (value: unknown): VisualProps => {
  const raw = isObject(value) ? value : {};
  return {
    content: str(raw.content, ''), fill: str(raw.fill, DEFAULT_PROPS.fill), stroke: str(raw.stroke, DEFAULT_PROPS.stroke),
    textColor: str(raw.textColor, DEFAULT_PROPS.textColor), accent: str(raw.accent, DEFAULT_PROPS.accent),
    strokeWidth: Math.max(0, num(raw.strokeWidth, 3)), cornerRadius: Math.max(0, num(raw.cornerRadius, 20)), fontSize: Math.max(8, num(raw.fontSize, 30)),
    ...(typeof raw.icon === 'string' ? { icon: raw.icon } : {}),
  };
};
const fields = (includeIcon = false) => [
  { path: 'content', label: '显示内容', control: 'textarea' as const, group: '内容' },
  ...(includeIcon ? [{ path: 'icon', label: '图标类型', control: 'select' as const, group: '内容', options: [
    { value: 'continue', label: '继续' }, { value: 'auto', label: '自动播放' }, { value: 'voice', label: '语音' }, { value: 'skip', label: '跳过' }, { value: 'log', label: '记录' },
  ] }] : []),
  { path: 'fill', label: '填充', control: 'color' as const, group: '视觉样式' },
  { path: 'stroke', label: '描边', control: 'color' as const, group: '视觉样式' },
  { path: 'textColor', label: '文字', control: 'color' as const, group: '视觉样式' },
  { path: 'accent', label: '强调', control: 'color' as const, group: '视觉样式' },
  { path: 'fontSize', label: '字号', control: 'number' as const, group: '视觉样式', min: 8 },
  { path: 'cornerRadius', label: '圆角', control: 'number' as const, group: '视觉样式', min: 0 },
  { path: 'strokeWidth', label: '描边宽', control: 'number' as const, group: '视觉样式', min: 0, step: .5 },
];
const roundRect = (ctx: CanvasRenderingContext2D, node: UiNode, props: VisualProps) => {
  const { x, y, width, height } = node.layout; ctx.beginPath(); ctx.roundRect(x, y, width, height, Math.min(props.cornerRadius, width / 2, height / 2));
};
const basePanel = (ctx: CanvasRenderingContext2D, node: UiNode, props: VisualProps) => {
  roundRect(ctx, node, props); ctx.fillStyle = props.fill; ctx.fill(); if (props.strokeWidth > 0) { ctx.strokeStyle = props.stroke; ctx.lineWidth = props.strokeWidth; ctx.stroke(); }
};
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = []; let line = '';
  for (const character of text) { const next = line + character; if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = character; } else line = next; }
  if (line) lines.push(line); return lines;
};
const boundText = (node: UiNode, props: VisualProps, runtime: UiRenderRuntime) => String(runtime.resolveBinding(node.bindings?.text?.source ?? '', props.content) ?? props.content);

const createDefinition = (definition: Omit<UiDefinition<VisualProps>, 'version' | 'category' | 'normalizeProps' | 'fields' | 'createDefaultProps'> & { iconField?: boolean; defaults?: Partial<VisualProps> }): UiDefinition<VisualProps> => ({
  version: 1, category: '对话界面', fields: fields(definition.iconField), normalizeProps: normalize,
  createDefaultProps: () => ({ ...DEFAULT_PROPS, ...definition.defaults }), ...definition,
});

const dialogueBox = createDefinition({ type: 'dialogue-box', label: '对话框', defaultSize: { width: 760, height: 190 }, defaults: { fill: '#101625', cornerRadius: 26, fontSize: 34 }, render: (ctx, node, runtime) => {
  const props = normalize(node.props); const { x, y, width, height } = node.layout; basePanel(ctx, node, props);
  ctx.fillStyle = props.accent; ctx.fillRect(x + 30, y + 34, 5, Math.max(20, height - 68)); ctx.fillStyle = props.textColor; ctx.font = `500 ${props.fontSize}px ui-sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  wrapText(ctx, boundText(node, props, runtime), width - 94).slice(0, Math.max(1, Math.floor((height - 64) / (props.fontSize * 1.5)))).forEach((line, index) => ctx.fillText(line, x + 58, y + 36 + index * props.fontSize * 1.5));
} });
const portrait = createDefinition({ type: 'portrait', label: '头像', defaultSize: { width: 390, height: 560 }, defaults: { fill: '#243a55', accent: '#68d5c3', cornerRadius: 28, fontSize: 112 }, render: (ctx, node) => {
  const props = normalize(node.props); const { x, y, width, height } = node.layout; const gradient = ctx.createLinearGradient(x, y, x, y + height); gradient.addColorStop(0, props.accent); gradient.addColorStop(.7, props.fill); gradient.addColorStop(1, '#0b1020');
  roundRect(ctx, node, props); ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = props.stroke; ctx.lineWidth = props.strokeWidth; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x + width / 2, y + height * .31, Math.min(width, height) * .19, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + width / 2, y + height * .74, width * .34, height * .25, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillStyle = props.textColor; ctx.font = `700 ${props.fontSize}px ui-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(props.content || '角', x + width / 2, y + height * .4);
} });
const centeredText = (type: string, label: string, size: { width: number; height: number }, bold: boolean) => createDefinition({ type, label, defaultSize: size, render: (ctx, node, runtime) => {
  const props = normalize(node.props); const { x, y, width, height } = node.layout; basePanel(ctx, node, props); ctx.fillStyle = props.textColor; ctx.font = `${bold ? 700 : 500} ${props.fontSize}px ui-sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(boundText(node, props, runtime) || node.name, x + width / 2, y + height / 2);
} });
const icon = createDefinition({ type: 'icon', label: '图标', iconField: true, defaultSize: { width: 48, height: 48 }, defaults: { cornerRadius: 21, fontSize: 20, icon: 'continue' }, render: (ctx, node) => {
  const props = normalize(node.props); const { x, y, width, height } = node.layout; basePanel(ctx, node, props); const cx = x + width / 2; const cy = y + height / 2; ctx.fillStyle = props.accent; ctx.strokeStyle = props.accent; ctx.lineWidth = Math.max(2, props.strokeWidth);
  if (props.icon === 'continue') { ctx.beginPath(); ctx.moveTo(cx - width * .12, cy - height * .2); ctx.lineTo(cx + width * .16, cy); ctx.lineTo(cx - width * .12, cy + height * .2); ctx.stroke(); }
  else if (props.icon === 'voice') { ctx.beginPath(); ctx.moveTo(x + width * .25, cy - height * .12); ctx.lineTo(x + width * .38, cy - height * .12); ctx.lineTo(x + width * .54, cy - height * .27); ctx.lineTo(x + width * .54, cy + height * .27); ctx.lineTo(x + width * .38, cy + height * .12); ctx.lineTo(x + width * .25, cy + height * .12); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(cx + width * .08, cy, width * .18, -.8, .8); ctx.stroke(); }
  else { ctx.font = `700 ${props.fontSize}px ui-sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(props.content || String(props.icon ?? 'continue').toUpperCase(), cx, cy); }
} });

export const createDialoguePreviewDefinitionRegistry = (): UiDefinitionRegistry => {
  const registry = new UiDefinitionRegistry();
  [dialogueBox, portrait, centeredText('nameplate', '姓名牌', { width: 226, height: 68 }, true), centeredText('text', '文字', { width: 360, height: 60 }, false), icon].forEach((definition) => registry.register(definition));
  registry.register({
    type: 'group', version: 1, label: 'Group', category: '布局', description: '只管理层级与整体变换，不绘制运行时内容。', defaultSize: { width: 320, height: 180 }, fields: [],
    createDefaultProps: () => ({}), normalizeProps: () => ({}), render: () => undefined,
  });
  return registry;
};
