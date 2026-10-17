import type { ReactNode } from 'react';
export function Navigation({ title, className, children }: { title: string; className?: string; children?: ReactNode }) { return <nav className={className}><strong>{title}</strong><a href="../../../index.html#draggable-labs">Lab 首页</a><a href="./index.html">运行页</a><a href="./editor.html">Puck 编辑器</a><a href="./grid.html">Grid 工作台</a>{children}</nav>; }
