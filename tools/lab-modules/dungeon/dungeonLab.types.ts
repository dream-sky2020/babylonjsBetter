import type {
  DungeonSession,
  DungeonSessionChanged,
  DungeonSessionController,
  DungeonSessionLibraries,
} from '@/core/dungeon-session';

export type DungeonLabLibraries = DungeonSessionLibraries;
export type DungeonSessionChangedEvent = DungeonSessionChanged;

export const DUNGEON_LAB_SERVICES = {
  libraries: 'dungeon:libraries',
  preset: 'dungeon:preset',
  sessionController: 'dungeon:session-controller',
  session: 'dungeon:session',
  sceneBinding: 'dungeon:scene-binding',
  sceneInstance: 'dungeon:scene-instance',
  spawn: 'dungeon:spawn',
  runtime: 'dungeon:runtime',
  obstacles: 'dungeon:obstacles',
} as const;

export type DungeonLabSession = DungeonSession;
export type DungeonLabSessionController = DungeonSessionController;
