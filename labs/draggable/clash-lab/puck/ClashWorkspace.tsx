import { PuckWorkbench } from '../../../kit/draggable/PuckWorkbench.tsx';
import { Navigation } from '../../../kit/draggable/Navigation.tsx';
import { clashPuckConfig } from './clashPuckConfig.tsx';
import { createDefaultLayout, parseLayout, LAYOUT_KEY } from './layoutData.ts';
export function ClashWorkspace({ editor = false }: { editor?: boolean }) { return <PuckWorkbench editor={editor} definition={{ id: 'clash', title: 'Clash Lab', storageKey: LAYOUT_KEY, config: clashPuckConfig, defaults: createDefaultLayout, parse: parseLayout, appClass: editor ? 'clash-editor' : 'clash-workspace', toolbarClass: 'clash-toolbar', navigation: <Navigation title="Clash Lab" className="clash-toolbar"><a href="./index.html?legacy=1">完整战斗参数</a></Navigation> }} />; }
