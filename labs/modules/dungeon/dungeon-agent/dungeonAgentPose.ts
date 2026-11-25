import { getDungeonMovementDirectionYaw } from '@/core/dungeon-movement';
import { resolveDungeonMapTileWorldLayout, type DungeonMapTileLayoutSettings } from '@/core/scene/dungeonMapSceneLayout';
import type { DungeonAgentState } from './dungeonAgent.memory';

const shortestAngleDelta = (from: number, to: number) => {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
};

export function resolveDungeonAgentPose(agent: DungeonAgentState, layout: DungeonMapTileLayoutSettings, width: number, height: number) {
  const tileCenter = (index: number) => resolveDungeonMapTileWorldLayout(layout, width, height, index % width, Math.floor(index / width)).center;
  const physicalPosition = agent.poseX === undefined || agent.poseY === undefined ? null
    : resolveDungeonMapTileWorldLayout(layout, width, height, agent.poseX, agent.poseY).center;
  if (!agent.movementKind) {
    return { position: physicalPosition ?? tileCenter(agent.tileIndex), yaw: getDungeonMovementDirectionYaw(agent.facing) };
  }
  const progress = agent.visualProgress ?? (agent.durationSeconds! <= 0 ? 1 : Math.min(1, agent.elapsedSeconds! / agent.durationSeconds!));
  const fromYaw = getDungeonMovementDirectionYaw(agent.fromFacing!);
  const yaw = fromYaw + shortestAngleDelta(fromYaw, getDungeonMovementDirectionYaw(agent.toFacing!)) * (agent.rotationProgress ?? progress);
  if (physicalPosition) return { position: physicalPosition, yaw };
  const from = tileCenter(agent.fromTileIndex!);
  const to = tileCenter(agent.toTileIndex!);
  return {
    position: [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
      from[2] + (to[2] - from[2]) * progress,
    ] as const,
    yaw,
  };
}
