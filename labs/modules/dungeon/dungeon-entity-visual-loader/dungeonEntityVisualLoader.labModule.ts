import { Color3, MeshBuilder, PointLight, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { createModelEntity } from '@/core/model';
import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import { readDungeonEntityVisuals, type DungeonEntityVisualDefinition } from '@/core/dungeon-visual-object/dungeonVisualDocument';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene/dungeonMapSceneLayout';
import { mapDungeonDisplayPosition, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView';
import type { LabModule } from '@/labs/kit';
import { DUNGEON_MAP_VISUAL_PREPARATION, type DungeonMapVisualCandidate } from '../dungeon-map-loader/dungeonMapVisualPreparation';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '../dungeon-overhead-view/dungeonOverheadView.references';

type LoadedVisual = { defaultEnabled: boolean; setEnabled(enabled: boolean): void };
export type DungeonLoadedVisualEntities = ReadonlyMap<string, {
  definition: DungeonEntityVisualDefinition;
  objects: ReadonlyMap<string, LoadedVisual>;
}>;
export const DUNGEON_ENTITY_VISUALS = createServiceToken<{
  current(): DungeonLoadedVisualEntities | undefined;
  initializeWith(initialize: (entities: DungeonLoadedVisualEntities) => void): () => void;
}>('dungeon:entity-visuals');

export const dungeonEntityVisualLoaderLabModule: LabModule = {
  id: 'dungeon-entity-visual-loader', dependencies: ['dungeon-map-loader', 'dungeon-overhead-view'],
  setup(context) {
    const map = context.services.get(DUNGEON_MAP_VISUAL_PREPARATION);
    const overhead = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const sessions = new Map<number, DungeonLoadedVisualEntities>();
    const initializers = new Set<(entities: DungeonLoadedVisualEntities) => void>();
    const releases = new Set<() => void>();

    async function prepare({ loadId, document, layout, root, signal }: DungeonMapVisualCandidate) {
      const { definitions, errors } = readDungeonEntityVisuals(document);
      if (errors.length) throw new Error(errors.join('\n'));
      const entities = new Map<string, { definition: DungeonEntityVisualDefinition; objects: Map<string, LoadedVisual> }>();
      if (!definitions.size) return;
      const group = new TransformNode(`entity-visuals:${loadId}`, context.scene);
      group.parent = root;
      const placements: { root: TransformNode; position: [number, number, number] }[] = [];
      const resources: (() => void)[] = [];
      const syncView = (view: ResolvedDungeonView | null) => {
        for (const entry of placements) entry.root.position.set(...mapDungeonDisplayPosition(view, entry.position));
      };
      const offView = overhead.subscribe(() => syncView(overhead.displayedView));
      const release = () => {
        if (!releases.delete(release)) return;
        offView();
        sessions.delete(loadId);
        try { for (const dispose of resources.reverse()) dispose(); }
        finally { group.dispose(false, true); }
      };
      releases.add(release);

      try {
        for (const definition of definitions.values()) {
          const anchor = new TransformNode(`visual-entity:${definition.entityId}`, context.scene);
          anchor.parent = group;
          const tile = resolveDungeonMapTileWorldLayout(layout, document.grid.width, document.grid.height, definition.tileX, definition.tileY);
          placements.push({ root: anchor, position: [tile.center[0], tile.center[1] + tile.size[1] / 2, tile.center[2]] });
          const objects = new Map<string, LoadedVisual>();
          for (const object of definition.objects) {
            signal.throwIfAborted();
            const name = `${definition.entityId}:${object.name}`;
            const defaultEnabled = object.enabled !== false;
            let node;
            if (object.kind === 'model') {
              const model = await createModelEntity(context.scene, object.modelPath, { parent: anchor, name, signal });
              if (signal.aborted || !releases.has(release)) { model.dispose(); throw new Error('实体视觉加载已取消。'); }
              resources.push(() => model.dispose());
              node = model.root;
            } else if (object.kind === 'point-light') {
              const light = new PointLight(name, Vector3.Zero(), context.scene);
              light.diffuse = Color3.FromHexString(object.color);
              light.intensity = object.intensity;
              light.range = object.range;
              node = light;
            } else {
              const mesh = MeshBuilder.CreateSphere(name, { diameter: object.diameter, segments: 12 }, context.scene);
              const material = new StandardMaterial(`${name}:material`, context.scene);
              material.disableLighting = true;
              material.emissiveColor = Color3.FromHexString(object.color);
              mesh.material = material;
              mesh.isPickable = false;
              node = mesh;
            }
            node.parent = anchor;
            node.position.set(...object.offset);
            node.setEnabled(defaultEnabled);
            const visual = node;
            objects.set(object.name, { defaultEnabled, setEnabled: enabled => visual.setEnabled(enabled) });
          }
          entities.set(definition.entityId, { definition, objects });
        }
        syncView(overhead.displayedView);
        for (const initialize of initializers) initialize(entities);
        sessions.set(loadId, entities);
        return release;
      } catch (error) {
        release();
        throw error;
      }
    }

    const unregister = map.register(prepare);
    context.services.set(DUNGEON_ENTITY_VISUALS, {
      current: () => sessions.get(map.activeLoadId()),
      initializeWith(initialize) { initializers.add(initialize); return () => { initializers.delete(initialize); }; },
    });
    return () => {
      unregister();
      for (const release of releases) release();
      context.services.delete(DUNGEON_ENTITY_VISUALS);
    };
  },
};
