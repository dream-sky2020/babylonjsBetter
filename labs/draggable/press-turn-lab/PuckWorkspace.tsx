import { PuckWorkbench } from '../../kit/draggable/PuckWorkbench.tsx';
import { defaultPuck, parsePuck, PUCK_KEY } from './layouts.ts';
import { puckConfig } from './puckConfig.tsx';
import { Navigation } from './Navigation.tsx';
export function PuckWorkspace({ editor }: { editor: boolean }) { return <PuckWorkbench editor={editor} definition={{ id: 'press-turn', title: 'Press Turn Lab', storageKey: PUCK_KEY, config: puckConfig, defaults: defaultPuck, parse: parsePuck, navigation: <Navigation current={editor ? 'Puck 编辑器' : '运行页'} />, appClass: 'pt-app', toolbarClass: 'pt-toolbar' }} />; }
