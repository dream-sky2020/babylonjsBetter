import { useEffect, useId, useState } from 'react';
import { DUNGEON_PLAYER_TARGET_ID, dungeonActorActionOptions, isDungeonActorStepDirection, type DungeonActorAction } from '@/core/dungeon-interaction/dungeonActorAction';
import { loadDungeonMapDocumentLibraryV2 } from '@/core/map/dungeonMapPresetRepository';
import type { DungeonMapDocumentLibraryV2 } from '@/core/map-document/dungeonMapDocument.codec';
import type { DungeonMapDocumentV2 } from '@/core/map-document/dungeonMapDocument.types';

const steps = {
  north: '北', east: '东', south: '南', west: '西',
  'north-east': '东北', 'south-east': '东南', 'south-west': '西南', 'north-west': '西北',
};

export const isKnownDungeonService = (id: string) =>
  id === 'obstacle.set-active' || dungeonActorActionOptions.some(option => option.commandId === id);

export function DungeonServiceIdField({ value, onChange }: { value: string; onChange(value: string): void }) {
  const id = useId();
  return <label className="field"><span>服务指令 ID</span>
    <input list={id} value={value} onChange={event => onChange(event.target.value)} />
    <datalist id={id}>
      <option value="obstacle.set-active">设置障碍启用状态</option>
      {dungeonActorActionOptions.map(option => <option key={option.commandId} value={option.commandId}>{option.label}</option>)}
    </datalist>
  </label>;
}

function TileField({ value, map, onChange }: { value: string; map?: DungeonMapDocumentV2; onChange(value: string): void }) {
  const [open, setOpen] = useState(false);
  const index = map?.grid.tileIds.indexOf(value) ?? -1;
  return <div>
    <label className="field"><span>落点格 ID</span>
      <input value={value} onChange={event => onChange(event.target.value)} />
    </label>
    {map ? <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{index < 0 ? '在地图格阵中选择' : '修改落点 (' + index % map.grid.width + ', ' + Math.floor(index / map.grid.width) + ')'}</button>
      {open && <div aria-label="落点格阵" style={{ display: 'grid', gridTemplateColumns: 'repeat(' + map.grid.width + ', 3.4em)', overflow: 'auto', maxHeight: '15rem', marginBlock: '0.5rem' }}>
        {map.grid.tileIds.map((id, ordinal) => {
          const coordinates = (ordinal % map.grid.width) + ',' + Math.floor(ordinal / map.grid.width);
          return <button type="button" key={id} title={id} aria-label={'格子 ' + coordinates} aria-pressed={id === value} onClick={() => { onChange(id); setOpen(false); }}>{coordinates}</button>;
        })}
      </div>}
      {value && index < 0 ? <small>当前参考地图没有这个格子。</small> : null}
    </> : null}
  </div>;
}

export function DungeonActorActionFields({ action, map, onChange }: {
  action: DungeonActorAction; map?: DungeonMapDocumentV2; onChange(value: DungeonActorAction): void;
}) {
  const actors = map?.entities.filter(entity => entity.entityType === 'dungeon-agent' && entity.enabled !== false);
  const target = action.targetEntityId || '';
  const missing = target && target !== DUNGEON_PLAYER_TARGET_ID && !actors?.some(actor => actor.id === target);
  return <>
    <label className="field"><span>目标角色</span>
      {map ? <select value={target} onChange={event => onChange({ ...action, targetEntityId: event.target.value })}>
        <option value="">选择角色</option>
        <option value={DUNGEON_PLAYER_TARGET_ID}>玩家</option>
        {actors?.map(actor => <option key={actor.id} value={actor.id}>{actor.name ? actor.name + ' · ' : ''}{actor.id}</option>)}
        {missing && <option value={target}>{target}（当前参考地图没有这个角色）</option>}
      </select> : <input value={target} placeholder="角色 ID（玩家为 $dungeon-player）"
        onChange={event => onChange({ ...action, targetEntityId: event.target.value })} />}
    </label>
    {!map && <button type="button" onClick={() => onChange({ ...action, targetEntityId: DUNGEON_PLAYER_TARGET_ID })}>选玩家</button>}
    {action.type === 'actor-teleport'
      ? <TileField value={action.tileId || ''} map={map} onChange={tileId => onChange({ ...action, tileId })} />
      : <label className="field"><span>移动方向</span>
        <select value={action.direction ?? ''} onChange={event => {
          const direction = event.target.value;
          if (isDungeonActorStepDirection(direction)) onChange({ ...action, direction });
        }}>
          {!action.direction && <option value="">选择方向</option>}
          {Object.entries(steps).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>}
  </>;
}

export function DungeonKnownServiceParameters({ id, parameters = {}, map, onChange }: {
  id: string; parameters?: Record<string, unknown>; map?: DungeonMapDocumentV2; onChange(value: Record<string, unknown>): void;
}) {
  const targetEntityId = typeof parameters.entityId === 'string' ? parameters.entityId : '';
  if (id === 'obstacle.set-active') return <>
    <label className="field"><span>障碍实体 ID</span><input value={targetEntityId}
      onChange={event => onChange({ active: false, ...parameters, entityId: event.target.value })} /></label>
    <label><input type="checkbox" checked={parameters.active === true}
      onChange={event => onChange({ ...parameters, active: event.target.checked })} />启用障碍</label>
  </>;
  const type = dungeonActorActionOptions.find(option => option.commandId === id)?.value;
  if (!type) return null;
  const action = (type === 'actor-teleport'
    ? { type, targetEntityId, tileId: typeof parameters.tileId === 'string' ? parameters.tileId : '' }
    : { type, targetEntityId, direction: isDungeonActorStepDirection(parameters.direction) ? parameters.direction : undefined }) as DungeonActorAction;
  return <DungeonActorActionFields action={action} map={map} onChange={next => {
    onChange(next.type === 'actor-teleport'
      ? { ...parameters, entityId: next.targetEntityId, tileId: next.tileId }
      : { ...parameters, entityId: next.targetEntityId, direction: next.direction });
  }} />;
}

export function DialogueActionReferenceMap({ children }: { children(map?: DungeonMapDocumentV2): React.ReactNode }) {
  const [maps, setMaps] = useState<DungeonMapDocumentLibraryV2>({});
  const [key, setKey] = useState('');
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadDungeonMapDocumentLibraryV2().then(value => {
      if (!cancelled) setMaps(value);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);
  return <>
    <label className="field"><span>参考地图（仅编辑时使用）</span>
      <select value={key} onChange={event => setKey(event.target.value)}>
        <option value="">不选择，手动填写 ID</option>
        {Object.entries(maps).map(([id, map]) => <option key={id} value={id}>{map.identity.name || id}</option>)}
      </select>
    </label>
    {loadError && <small>无法加载参考地图，可以手动填写 ID。</small>}
    {children(maps[key])}
  </>;
}
