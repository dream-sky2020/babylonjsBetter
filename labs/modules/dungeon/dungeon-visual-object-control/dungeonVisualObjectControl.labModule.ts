import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import { createLabField, createLabStatus, type LabModule } from '@/labs/kit';
import { DUNGEON_ENTITY_VISUALS, type DungeonLoadedVisualEntities } from '../dungeon-entity-visual-loader/dungeonEntityVisualLoader.labModule';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { chooseVisualState, type VisualShuffleProgress } from '@/core/dungeon-visual-object/visualStateRotation';
import { visualRotationLabels, visualRotationModes, type VisualRotationMode } from '@/core/entity/components/visual-state.component';

type VisualStateResult = { stateId: string; label: string; changed: boolean };
type VisualSessionState = {
  current: Map<string, string>;
  shuffle: Map<string, Map<string, VisualShuffleProgress>>;
};
export const DUNGEON_VISUAL_OBJECT_CONTROL = createServiceToken<{
  setState(entityId: string, stateId: string): VisualStateResult;
  advanceState(entityId: string, groupId: string, mode: VisualRotationMode): VisualStateResult;
  getState(entityId: string): string | undefined;
}>('dungeon:visual-object-control');

export const dungeonVisualObjectControlLabModule: LabModule = {
  id: 'dungeon-visual-object-control', dependencies: ['dungeon-entity-visual-loader'],
  setup(context) {
    const loaded = context.services.get(DUNGEON_ENTITY_VISUALS);
    const sessionStates = new WeakMap<DungeonLoadedVisualEntities, VisualSessionState>();
    const apply = (entities: DungeonLoadedVisualEntities, states: Map<string, string>, entityId: string, stateId: string) => {
      const entity = entities.get(entityId);
      const state = entity?.definition.states?.states.find(item => item.id === stateId);
      if (!entity || !state) throw new Error(`视觉对象 ${entityId} 没有状态 ${stateId}。`);
      const changed = states.get(entityId) !== stateId;
      if (changed) {
        for (const [name, object] of entity.objects) {
          object.setEnabled(Object.hasOwn(state.enabled, name) ? state.enabled[name] : object.defaultEnabled);
        }
        states.set(entityId, stateId);
      }
      return { stateId, label: state.label ?? stateId, changed };
    };
    const offInitialize = loaded.initializeWith(entities => {
      const states = new Map<string, string>();
      for (const [id, entity] of entities) {
        if (entity.definition.states) apply(entities, states, id, entity.definition.states.initialState);
      }
      sessionStates.set(entities, { current: states, shuffle: new Map() });
    });

    const panel = context.ui.addPanel('dungeon-visual-object-control', '地牢视觉对象控制');
    const target = document.createElement('select');
    const state = document.createElement('select');
    const group = document.createElement('select');
    const mode = document.createElement('select');
    mode.replaceChildren(...visualRotationModes.map(value => new Option(visualRotationLabels[value], value)));
    const applyButton = document.createElement('button');
    applyButton.type = 'button'; applyButton.textContent = '测试切换状态';
    const advanceButton = document.createElement('button');
    advanceButton.type = 'button'; advanceButton.textContent = '测试轮替';
    const status = createLabStatus('当前地图没有可切换的视觉对象。');
    panel.content.append(createLabField('视觉对象', target), createLabField('目标状态', state), applyButton,
      createLabField('轮替组', group), createLabField('轮替模式', mode), advanceButton, status);
    const getState = (entityId: string) => {
      const entities = loaded.current();
      return entities && sessionStates.get(entities)?.current.get(entityId);
    };
    const showCurrent = () => {
      const stateId = getState(target.value);
      const label = loaded.current()?.get(target.value)?.definition.states?.states.find(item => item.id === stateId)?.label;
      status.textContent = target.value ? `当前状态：${label ?? stateId ?? '未加载'}` : '当前地图没有可切换的视觉对象。';
      status.dataset.state = stateId ?? '';
      status.dataset.error = 'false';
    };
    const requireSession = () => {
      const entities = loaded.current();
      const states = entities && sessionStates.get(entities);
      if (!entities || !states) throw new Error('当前地图的视觉对象尚未就绪。');
      return { entities, states };
    };
    const setState = (entityId: string, stateId: string) => {
      const { entities, states } = requireSession();
      const result = apply(entities, states.current, entityId, stateId);
      showCurrent();
      return result;
    };
    const advanceState = (entityId: string, groupId: string, operation: VisualRotationMode) => {
      const { entities, states } = requireSession();
      const rotation = entities.get(entityId)?.definition.states?.rotationGroups?.find(item => item.id === groupId);
      if (!rotation) throw new Error(`视觉对象 ${entityId} 没有轮替组 ${groupId}。`);
      const bags = states.shuffle.get(entityId) ?? new Map<string, VisualShuffleProgress>();
      const selection = chooseVisualState(rotation.stateIds, operation, states.current.get(entityId), bags.get(groupId));
      const result = apply(entities, states.current, entityId, selection.stateId);
      if (selection.progress) {
        bags.set(groupId, selection.progress);
        states.shuffle.set(entityId, bags);
      }
      showCurrent();
      return result;
    };
    const fillStates = () => {
      const current = loaded.current()?.get(target.value)?.definition.states;
      state.replaceChildren(...(current?.states ?? []).map(item => new Option(item.label ?? item.id, item.id)));
      state.value = getState(target.value) ?? '';
      applyButton.disabled = !state.options.length;
      group.replaceChildren(...(current?.rotationGroups ?? []).map(item => new Option(item.id, item.id)));
      group.disabled = mode.disabled = advanceButton.disabled = !group.options.length;
      showCurrent();
    };
    const refresh = () => {
      target.replaceChildren(...[...(loaded.current()?.values() ?? [])].flatMap(({ definition }) =>
        definition.states ? [new Option(`${definition.label} · ${definition.entityId}`, definition.entityId)] : []));
      fillStates();
    };
    target.addEventListener('change', fillStates);
    applyButton.addEventListener('click', () => {
      try { setState(target.value, state.value); } catch (error) { status.textContent = String(error); status.dataset.error = 'true'; }
    });
    advanceButton.addEventListener('click', () => {
      try { advanceState(target.value, group.value, mode.value as VisualRotationMode); }
      catch (error) { status.textContent = String(error); status.dataset.error = 'true'; }
    });
    const offMap = context.communication.on(dungeonMapChangedEvent, refresh);
    context.services.set(DUNGEON_VISUAL_OBJECT_CONTROL, { setState, advanceState, getState });
    refresh();
    return () => { offMap(); offInitialize(); context.services.delete(DUNGEON_VISUAL_OBJECT_CONTROL); panel.root.remove(); };
  },
};
