import type { UiDefinitionRegistry } from './uiDefinition.registry.ts';
import type { UiDocument, UiNode, UiPoint, UiRenderRuntime } from './uiDocument.types.ts';
import { resolveUiNodeLayout } from './uiDocument.layout.ts';

const createRuntime = (document: UiDocument, mode: UiRenderRuntime['mode'], requestRender: () => void): UiRenderRuntime => ({
  mode, assets: { getImage: () => undefined }, resolveBinding: (path, fallback) => document.previewContext?.[path] ?? fallback, requestRender,
});
export const resolveUiNode = resolveUiNodeLayout;

export const listUiNodesInPaintOrder = (document: UiDocument): UiNode[] => {
  const result: UiNode[] = [];
  const ordered = (ids: string[]) => ids.map((id, index) => ({ id, index })).sort((left, right) => (document.nodes[left.id]?.layout.zIndex ?? 0) - (document.nodes[right.id]?.layout.zIndex ?? 0) || left.index - right.index);
  const visit = (id: string) => { const node = resolveUiNode(document, id); if (!node) return; result.push(node); ordered(document.nodes[id]?.childIds ?? []).forEach((entry) => visit(entry.id)); };
  ordered(document.rootIds).forEach((entry) => visit(entry.id));
  return result;
};
export const renderUiDocument = (ctx: CanvasRenderingContext2D, document: UiDocument, registry: UiDefinitionRegistry, options: { mode: UiRenderRuntime['mode']; requestRender?: () => void; beforeNodes?: (ctx: CanvasRenderingContext2D) => void }): void => {
  const { width, height, backgroundTop, backgroundBottom } = document.canvas;
  const background = ctx.createLinearGradient(0, 0, 0, height); background.addColorStop(0, backgroundTop); background.addColorStop(1, backgroundBottom); ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  options.beforeNodes?.(ctx);
  const runtime = createRuntime(document, options.mode, options.requestRender ?? (() => undefined));
  listUiNodesInPaintOrder(document).filter((node) => node.visible).forEach((node) => {
    ctx.save(); ctx.globalAlpha = node.opacity; const definition = registry.get(node.type);
    if (definition) definition.render(ctx, node, runtime);
    else {
      const { x, y, width: nodeWidth, height: nodeHeight } = node.layout;
      ctx.fillStyle = 'rgba(91, 18, 31, .78)'; ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 3; ctx.fillRect(x, y, nodeWidth, nodeHeight); ctx.strokeRect(x, y, nodeWidth, nodeHeight);
      ctx.fillStyle = '#fecdd3'; ctx.font = '700 18px ui-sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`缺少定义：${node.type}`, x + nodeWidth / 2, y + nodeHeight / 2);
    }
    ctx.restore();
  });
};
export const hitTestUiDocument = (document: UiDocument, registry: UiDefinitionRegistry, point: UiPoint): UiNode | undefined => [...listUiNodesInPaintOrder(document)].reverse().find((node) => {
  if (!node.visible) return false; const definition = registry.get(node.type); if (definition?.hitTest) return definition.hitTest(point, node);
  const { x, y, width, height } = node.layout; return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
});
