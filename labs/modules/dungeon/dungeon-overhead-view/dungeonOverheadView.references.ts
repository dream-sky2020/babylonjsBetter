import type { DungeonOverheadViewConfig, ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';

export const DUNGEON_OVERHEAD_VIEW_SERVICE_KEY = 'dungeon:overhead-view';
export type DungeonOverheadViewService = {
  readonly view: ResolvedDungeonView | null;
  readonly configuredView: ResolvedDungeonView | null;
  readonly displayedView: ResolvedDungeonView | null;
  subscribe(listener: () => void): () => void;
  mountTransitionControl(row: HTMLElement, apply: () => void): () => void;
  setDraft(config: DungeonOverheadViewConfig | null): void;
  setEnabled(enabled: boolean): void;
};
