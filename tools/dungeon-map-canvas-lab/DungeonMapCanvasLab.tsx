import { useDungeonMapCanvasLabActivity } from './DungeonMapCanvasLabActivity';
import { DungeonMapCanvasLabView } from './DungeonMapCanvasLabView';

export const DungeonMapCanvasLab = () => {
  const model = useDungeonMapCanvasLabActivity();
  return <DungeonMapCanvasLabView model={model} />;
};
