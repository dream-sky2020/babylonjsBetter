import { createLabStatus, type LabModule } from '@/tools/lab-kit';

const NODES = [
  { id: 'game', label: 'GameRuntime', x: 0.5, y: 0.18, color: '#4fa9d8' },
  { id: 'world', label: 'WorldRuntime', x: 0.5, y: 0.42, color: '#5fc99a' },
  { id: 'session', label: 'DungeonSession', x: 0.3, y: 0.7, color: '#d9a85d' },
  { id: 'deltas', label: 'dungeonDeltas', x: 0.7, y: 0.7, color: '#b989d8' },
] as const;

export const viewportLayersLabModule: LabModule = {
  id: 'viewport-layers',
  setup(context) {
    const panel = context.ui.addPanel('viewport-layers', 'Viewport 覆盖层');
    const openCanvas = document.createElement('button');
    openCanvas.type = 'button';
    openCanvas.textContent = '打开 Canvas 数据视图';
    const openHtml = document.createElement('button');
    openHtml.type = 'button';
    openHtml.textContent = '打开 HTML 数据视图';
    const closeAll = document.createElement('button');
    closeAll.type = 'button';
    closeAll.textContent = '返回 Babylon 场景';
    const status = createLabStatus('覆盖层关闭；Babylon 场景可交互。');
    panel.content.append(openCanvas, openHtml, closeAll, status);

    let selectedId = 'world';
    const canvasLayer = context.viewport.openCanvasLayer({
      id: 'viewport-demo-canvas',
      title: 'Canvas · 运行时数据关系',
      mode: 'exclusive',
      interactive: true,
      pauseBabylonRendering: true,
      clearColor: '#091118',
      onRender({ context2d: draw, width, height }) {
        draw.lineWidth = 2;
        draw.strokeStyle = '#526b7c';
        const byId = Object.fromEntries(NODES.map((node) => [node.id, node]));
        ([['game', 'world'], ['world', 'session'], ['world', 'deltas']] as const).forEach(([fromId, toId]) => {
          const from = byId[fromId];
          const to = byId[toId];
          draw.beginPath();
          draw.moveTo(from.x * width, from.y * height);
          draw.lineTo(to.x * width, to.y * height);
          draw.stroke();
        });
        NODES.forEach((node) => {
          const x = node.x * width;
          const y = node.y * height;
          const selected = selectedId === node.id;
          draw.fillStyle = selected ? '#f2d679' : node.color;
          draw.strokeStyle = selected ? '#fff0aa' : '#d6e6ef';
          draw.lineWidth = selected ? 4 : 2;
          draw.beginPath();
          draw.roundRect(x - 82, y - 25, 164, 50, 8);
          draw.fill();
          draw.stroke();
          draw.fillStyle = '#081018';
          draw.font = '600 14px Segoe UI, Microsoft YaHei, sans-serif';
          draw.textAlign = 'center';
          draw.textBaseline = 'middle';
          draw.fillText(node.label, x, y);
        });
      },
    });
    const onCanvasPointer = (event: PointerEvent) => {
      const rect = canvasLayer.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const selected = NODES.find((node) => (
        Math.abs(x - node.x * rect.width) <= 82 && Math.abs(y - node.y * rect.height) <= 25
      ));
      if (!selected) return;
      selectedId = selected.id;
      status.textContent = `Canvas 已选择：${selected.label}`;
      canvasLayer.requestRender();
    };
    canvasLayer.canvas.addEventListener('pointerdown', onCanvasPointer);

    const htmlLayer = context.viewport.openHtmlLayer({
      id: 'viewport-demo-html',
      title: 'HTML · 运行时数据详情',
      mode: 'exclusive',
      interactive: true,
      pauseBabylonRendering: true,
    });
    const heading = document.createElement('h2');
    heading.textContent = 'Runtime Data Overview';
    const explanation = document.createElement('p');
    explanation.textContent = '这是由 Lab Module 临时打开的 HTML Viewport Layer。关闭后会恢复 Babylon 场景和相机输入。';
    const grid = document.createElement('div');
    grid.className = 'lab-viewport-demo-grid';
    NODES.forEach((node) => {
      const card = document.createElement('article');
      const title = document.createElement('strong');
      title.textContent = node.label;
      const detail = document.createElement('small');
      detail.textContent = `Key: ${node.id} · Public · Session`;
      card.append(title, detail);
      grid.append(card);
    });
    htmlLayer.content.append(heading, explanation, grid);

    openCanvas.addEventListener('click', () => {
      canvasLayer.show();
      status.textContent = 'Canvas 独占层已打开；Babylon 输入和渲染已暂停。';
    });
    openHtml.addEventListener('click', () => {
      htmlLayer.show();
      status.textContent = 'HTML 独占层已打开；Canvas 独占层会自动隐藏。';
    });
    closeAll.addEventListener('click', () => {
      canvasLayer.hide();
      htmlLayer.hide();
      status.textContent = '覆盖层已关闭；Babylon 场景和相机输入已恢复。';
    });

    return () => {
      canvasLayer.canvas.removeEventListener('pointerdown', onCanvasPointer);
      canvasLayer.dispose();
      htmlLayer.dispose();
    };
  },
};
