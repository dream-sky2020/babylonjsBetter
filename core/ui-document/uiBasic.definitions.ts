import type { UiDefinition, UiNode, UiRenderRuntime } from './uiDocument.types.ts';
const defaults = { content: '', fill: '#162337', stroke: '#30465c', textColor: '#e9f0f7', accent: '#71cdb5', fontSize: 20, cornerRadius: 8, strokeWidth: 1, value: 70, maximum: 100, action: '' };
const normalize = (value: unknown): typeof defaults => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof fallback === 'number' ? typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? raw[key] : fallback : typeof raw[key] === 'string' ? raw[key] : fallback])) as typeof defaults;
};
const bound = (node: UiNode, runtime: UiRenderRuntime, key: string, fallback: unknown) => runtime.resolveBinding(node.bindings?.[key]?.source ?? '', fallback);
export const uiBasicDefinitions: UiDefinition[] = ['panel','label','button','resource-bar'].map(type => ({
  type, version: 1, category: '通用 UI', label: ({ panel: '面板', label: '文本标签', button: '按钮', 'resource-bar': '资源条' } as Record<string,string>)[type], defaultSize: type === 'panel' ? {width:360,height:240} : {width:240,height:48},
  createDefaultProps: () => ({...defaults}), normalizeProps: normalize,
  fields: [
    {path:'content',label:'显示文字',control:'text',group:'内容'},
    ...(['value','maximum'].filter(() => type === 'resource-bar').map(path => ({path,label:path==='value'?'当前值':'上限',control:'number' as const,group:'数值',min:0}))),
    ...(type === 'button' ? [{path:'action',label:'预览动作',control:'text' as const,group:'内容'}] : []),
    ...(['fill','stroke','textColor','accent'].map(path => ({path,label:({fill:'背景',stroke:'边框',textColor:'文字',accent:'进度颜色'} as Record<string,string>)[path],control:'color' as const,group:'样式'}))),
    {path:'fontSize',label:'字号',control:'number',group:'样式',min:8}, {path:'cornerRadius',label:'圆角',control:'number',group:'样式',min:0}, {path:'strokeWidth',label:'边框宽',control:'number',group:'样式',min:0},
  ],
  render(ctx, node, runtime) {
    const p = normalize(node.props); const {x,y,width,height} = node.layout;
    const content = String(bound(node,runtime,'text',p.content) ?? '');
    const fill = String(bound(node,runtime,'fill',p.fill));
    ctx.beginPath();ctx.roundRect(x,y,width,height,Math.max(0,Math.min(p.cornerRadius,width/2,height/2)));
    if(type!=='label'){ctx.fillStyle=fill;ctx.fill();if(p.strokeWidth>0){ctx.strokeStyle=p.stroke;ctx.lineWidth=p.strokeWidth;ctx.stroke();}}
    ctx.fillStyle=p.textColor;ctx.font=`${type==='button'?600:500} ${Math.max(8,p.fontSize)}px "Microsoft YaHei",sans-serif`;ctx.textBaseline='middle';
    if(type==='resource-bar') {
      const value=Number(bound(node,runtime,'value',p.value));const maximum=Number(bound(node,runtime,'maximum',p.maximum));
      const ratio=Number.isFinite(value)&&Number.isFinite(maximum)&&maximum>0?Math.max(0,Math.min(1,value/maximum)):0;
      ctx.save();ctx.clip();ctx.fillStyle=p.accent;ctx.fillRect(x,y+height-8,width*ratio,8);ctx.restore();
      ctx.fillStyle=p.textColor;ctx.textAlign='left';ctx.fillText(content,x+12,y+(height-8)/2,width-24);ctx.textAlign='right';ctx.fillText(`${Number.isFinite(value)?value:0} / ${Number.isFinite(maximum)?maximum:0}`,x+width-12,y+(height-8)/2,width-24);
    } else if(type!=='panel'){ctx.textAlign=type==='button'?'center':'left';ctx.fillText(content,type==='button'?x+width/2:x+4,y+height/2,Math.max(1,width-8));}
  },
}));
