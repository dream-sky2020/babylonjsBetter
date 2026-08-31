import React, { useMemo, useState } from 'react';
import type {
  ComponentFieldSchema,
  EntityContainerKind,
  IComponent,
  IEntity,
  IEntityContainer,
} from '@/core/entity';
import {
  componentRegistry,
  createEntityFromDefinition,
  entityTypeRegistry,
} from './entityDefinitionCatalog';
import './entity-container-editor.css';

type FieldOptionsProvider = (
  component: IComponent,
  field: ComponentFieldSchema,
) => readonly { value: string; label: string }[] | undefined;

export type EntityContainerEditorProps = {
  containerKind: EntityContainerKind;
  value: IEntityContainer;
  onChange: (value: IEntityContainer) => void;
  lockedEntityTypes?: readonly string[];
  fieldOptions?: FieldOptionsProvider;
};

const valueAtPath = (source: Record<string, unknown>, path: string): unknown => path
  .split('.')
  .reduce<unknown>((value, key) => value && typeof value === 'object'
    ? (value as Record<string, unknown>)[key]
    : undefined, source);

const valueWithPath = <T extends Record<string, unknown>>(source: T, path: string, value: unknown): T => {
  const keys = path.split('.');
  const next = structuredClone(source);
  let cursor: Record<string, unknown> = next;
  keys.slice(0, -1).forEach((key) => {
    const child = cursor[key];
    cursor[key] = child && typeof child === 'object' && !Array.isArray(child) ? child : {};
    cursor = cursor[key] as Record<string, unknown>;
  });
  if (value === undefined) delete cursor[keys.at(-1)!];
  else cursor[keys.at(-1)!] = value;
  return next;
};

export const EntityContainerEditor = ({
  containerKind,
  value,
  onChange,
  lockedEntityTypes = [],
  fieldOptions,
}: EntityContainerEditorProps) => {
  const definitions = useMemo(() => entityTypeRegistry.listForContainer(containerKind), [containerKind]);
  const availableDefinitions = definitions.filter((definition) => definition.allowMultiplePerContainer !== false
    || !value.entities.some((entity) => entity.entityType === definition.type));
  const [entityTypeToAdd, setEntityTypeToAdd] = useState('');
  const effectiveEntityType = availableDefinitions.some((item) => item.type === entityTypeToAdd)
    ? entityTypeToAdd
    : availableDefinitions[0]?.type ?? '';

  const updateEntity = (entityId: string, updater: (entity: IEntity) => IEntity) => onChange({
    ...value,
    entities: value.entities.map((entity) => entity.id === entityId ? updater(entity) : entity),
  });
  const updateComponent = (
    entityId: string,
    componentId: string,
    updater: (component: IComponent) => IComponent,
  ) => updateEntity(entityId, (entity) => ({
    ...entity,
    components: entity.components.map((component) => component.id === componentId
      ? updater(component)
      : component),
  }));

  const renderField = (entity: IEntity, component: IComponent, field: ComponentFieldSchema) => {
    const currentValue = valueAtPath(component, field.path);
    const setField = (nextValue: unknown) => updateComponent(entity.id, component.id, (current) => (
      valueWithPath(current, field.path, nextValue)
    ));
    const dynamicOptions = fieldOptions?.(component, field);
    const options = dynamicOptions ?? field.options;
    if (field.control === 'checkbox') return <label className="ece-check" key={field.path}><input type="checkbox" checked={currentValue === true} onChange={(event) => setField(event.target.checked)} /><span>{field.label}</span></label>;
    if (field.control === 'select' || dynamicOptions) return <label key={field.path}><span>{field.label}</span><select value={String(currentValue ?? '')} onChange={(event) => setField(event.target.value || undefined)}>{field.optional ? <option value="">不启用</option> : null}{options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    if (field.control === 'tags') return <label key={`${component.id}-${field.path}-${JSON.stringify(currentValue)}`}><span>{field.label}</span><textarea rows={2} defaultValue={Array.isArray(currentValue) ? currentValue.join(', ') : ''} onBlur={(event) => setField(event.target.value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))} /></label>;
    if (field.control === 'json') return <label key={`${component.id}-${field.path}-${JSON.stringify(currentValue)}`}><span>{field.label}</span><textarea rows={5} defaultValue={currentValue === undefined ? '' : JSON.stringify(currentValue, null, 2)} onBlur={(event) => { try { event.target.setCustomValidity(''); setField(event.target.value.trim() ? JSON.parse(event.target.value) : undefined); } catch { event.target.setCustomValidity('请输入合法 JSON'); event.target.reportValidity(); } }} /></label>;
    if (field.control === 'number') return <label key={`${component.id}-${field.path}-${String(currentValue)}`}><span>{field.label}</span><input type="number" min={field.min} max={field.max} step={field.step ?? 1} defaultValue={typeof currentValue === 'number' ? currentValue : ''} onBlur={(event) => setField(event.target.value === '' ? undefined : Number(event.target.value))} /></label>;
    return <label key={`${component.id}-${field.path}-${String(currentValue)}`}><span>{field.label}</span><input defaultValue={String(currentValue ?? '')} placeholder={field.placeholder} onBlur={(event) => setField(event.target.value || undefined)} /></label>;
  };

  return <div className="entity-container-editor">
    <div className="ece-toolbar">
      <label><span>新增 Entity 类型</span><select value={effectiveEntityType} disabled={!effectiveEntityType} onChange={(event) => setEntityTypeToAdd(event.target.value)}>{availableDefinitions.length ? availableDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>) : <option value="">当前容器无可用类型</option>}</select></label>
      <button type="button" disabled={!effectiveEntityType} onClick={() => {
        const definition = entityTypeRegistry.get(effectiveEntityType);
        if (definition) onChange({ ...value, entities: [...value.entities, createEntityFromDefinition(definition)] });
      }}>＋ 添加 Entity</button>
    </div>
    {value.entities.length === 0 ? <div className="ece-empty">世界数据容器中暂无 Entity。</div> : null}
    <div className="ece-entity-list">{value.entities.map((entity) => {
      const entityDefinition = entityTypeRegistry.get(entity.entityType);
      const requiredComponents = entityDefinition?.requiredComponents ?? [];
      const componentDefinitions = componentRegistry.listForEntity(entity.entityType).filter((definition) => definition.allowMultiple !== false
        || !entity.components.some((component) => component.type === definition.type));
      return <section className="ece-entity" key={entity.id}>
        <header><div><strong>{entity.name || '未命名 Entity'}</strong><small>{entityDefinition?.label ?? `未注册：${entity.entityType}`}</small></div><button type="button" className="ece-danger" disabled={lockedEntityTypes.includes(entity.entityType)} onClick={() => onChange({ ...value, entities: value.entities.filter((item) => item.id !== entity.id) })}>{lockedEntityTypes.includes(entity.entityType) ? '世界必需' : '删除'}</button></header>
        <div className="ece-fields"><label><span>名称</span><input defaultValue={entity.name ?? ''} onBlur={(event) => updateEntity(entity.id, (current) => ({ ...current, name: event.target.value || undefined }))} /></label><label><span>Entity ID</span><input value={entity.id} readOnly /></label><label className="ece-check"><input type="checkbox" checked={entity.enabled !== false} onChange={(event) => updateEntity(entity.id, (current) => ({ ...current, enabled: event.target.checked }))} /><span>启用 Entity</span></label></div>
        <div className="ece-component-toolbar"><strong>Components</strong><select id={`add-${entity.id}`} defaultValue=""> <option value="">选择组件</option>{componentDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select><button type="button" onClick={(event) => { const select = event.currentTarget.previousElementSibling as HTMLSelectElement; const definition = componentRegistry.get(select.value); if (definition) updateEntity(entity.id, (current) => ({ ...current, components: [...current.components, definition.createDefault()] })); select.value = ''; }}>＋ 添加</button></div>
        <div className="ece-component-list">{entity.components.map((component) => {
          const definition = componentRegistry.get(component.type);
          const required = requiredComponents.includes(component.type);
          return <article className="ece-component" key={component.id}><header><div><strong>{definition?.label ?? component.type}</strong><small>{component.type} · v{component.version}</small></div><label className="ece-check"><input type="checkbox" checked={component.enabled !== false} onChange={(event) => updateComponent(entity.id, component.id, (current) => ({ ...current, enabled: event.target.checked }))} /><span>启用</span></label></header>{definition ? <div className="ece-fields">{definition.fields.map((field) => renderField(entity, component, field))}</div> : <label><span>未注册组件 JSON</span><textarea value={JSON.stringify(component, null, 2)} readOnly rows={6} /></label>}<button type="button" className="ece-danger" disabled={required} onClick={() => updateEntity(entity.id, (current) => ({ ...current, components: current.components.filter((item) => item.id !== component.id) }))}>{required ? '必需组件' : '删除组件'}</button></article>;
        })}</div>
      </section>;
    })}</div>
  </div>;
};
