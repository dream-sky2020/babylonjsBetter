import { getComponents } from '../entity/entity.utils.ts';
import type { ISceneEnvironmentComponent } from '../entity/components/scene-environment.component.ts';
import type { DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import type {
  DungeonMapSceneEnvironmentBinding,
} from './createDungeonMapSceneEnvironment.ts';
import type { SceneEnvironmentPresetLibrary } from './sceneEnvironment.types.ts';

/** 从 V2 map 空间挂载直接解析唯一场景环境声明。 */
export const resolveDungeonDocumentSceneEnvironment = (
  document: DungeonMapDocumentV2,
  presets: SceneEnvironmentPresetLibrary,
): DungeonMapSceneEnvironmentBinding => {
  const query = new DungeonMapDocumentQuery(document);
  const bindings = query.getEntitiesAt({ kind: 'map' }).flatMap(({ id }) => {
    const mapEntity = query.getEntitySnapshot(id);
    if (!mapEntity || mapEntity.entityType !== 'map' || mapEntity.enabled === false) return [];
    return getComponents<ISceneEnvironmentComponent>(mapEntity, 'scene-environment')
      .filter((component) => component.enabled !== false)
      .map((component) => ({ mapEntity, component }));
  });
  if (bindings.length === 0) {
    throw new Error(`地图“${document.identity.id}”的 map 空间挂载中没有可用的 scene-environment 组件。`);
  }
  if (bindings.length > 1) {
    throw new Error(`地图“${document.identity.id}”存在多个启用的 scene-environment 组件，无法确定唯一场景。`);
  }
  const [{ mapEntity, component }] = bindings;
  const presetKey = component.presetKey?.trim();
  if (!presetKey) throw new Error(`组件“${component.id}”没有设置 presetKey。`);
  const preset = presets[presetKey];
  if (!preset) throw new Error(`场景预设库中找不到 key“${presetKey}”。`);
  return { mapEntity, component, preset };
};
