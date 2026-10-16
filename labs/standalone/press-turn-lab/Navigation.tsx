export function Navigation({ current }: { current: string }) {
  return <><header className="pt-title"><b>▣ Press Turn · 大小行动点战斗试验台</b><span>{current}</span></header><nav className="pt-toolbar"><a href="../../../index.html">← Lab 入口</a><a href="./index.html">运行页</a><a href="./editor.html">Puck 编辑器</a><a href="./grid.html">Grid 工作台</a><small>PRESS TURN CONTROL SYSTEM</small></nav></>;
}
