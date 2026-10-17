import { Navigation as WorkbenchNavigation } from '../../kit/draggable/Navigation.tsx';
export function Navigation({ current }: { current: string }) {
  return <><header className="pt-title"><b>▣ Press Turn · 大小行动点战斗试验台</b><span>{current}</span></header><WorkbenchNavigation title="Press Turn Lab" className="pt-toolbar"><small>PRESS TURN CONTROL SYSTEM</small></WorkbenchNavigation></>;
}
