import type { DungeonMapTopologyMode } from '@/core/map';
import { resolveBatchFieldValue, type ComponentFieldSchema, type IComponent, type IEntity } from '@/core/entity';
import { componentDefinitions as COMPONENT_DEFINITIONS, componentRegistry as COMPONENT_REGISTRY, entityTypeDefinitions as ENTITY_TYPE_DEFINITIONS, entityTypeRegistry as ENTITY_TYPE_REGISTRY } from '@/tools/entity-container-editor';
import { DungeonMapCanvas } from '@/core/ui/DungeonMapCanvas';
import { DungeonMapCanvas3D } from './DungeonMapCanvas3D';
import { valueWithPath, valueAtPath, SELECTION_LIST_PREVIEW_LIMIT, selectionObjectLabel, selectionObjectId, SELECTION_MODE_LABEL, DIRECTION_LABEL, PATTERN_MODULES, PATTERN_LABELS, ENTITY_TYPE_COLORS } from './DungeonMapCanvasLabActivity';
import type { DungeonMapCanvasLabViewModel } from './DungeonMapCanvasLabActivity';

export const DungeonMapCanvasLabView = ({ model }: { model: DungeonMapCanvasLabViewModel }) => {
  const {
    activeBatchComponentDefinition,
    activeBatchComponents,
    activeBatchEntityGroup,
    activePreset,
    activePresetKey,
    addComponentToEntity,
    addEntityToSelection,
    availableEntityDefinitions,
    batchAddComponent,
    batchComponentCreateDefinitions,
    batchComponentDeleteDefinitions,
    batchComponentEditDefinitions,
    batchComponentGroups,
    batchComponentSlotDraft,
    batchContainerTargets,
    batchCreateEntity,
    batchDeleteComponent,
    batchEntityArchetypeDraft,
    batchEntityDefinitions,
    batchEntityGroups,
    batchEntityTargets,
    batchSetComponentField,
    cancelMutationPlan,
    canvasOuterPadding,
    canvasSelection,
    canvasSelections,
    cellSize,
    changeSelectionMode,
    cleanupGeneratedTopologyShells,
    collapsedPanelIds,
    compatibleBatchEntityGroups,
    componentTypeToAdd,
    confirmMutationPlan,
    confirmPresetKeyChange,
    copySelectedContainersJson,
    createMapPreset,
    currentLoadedLargeSelectionJson,
    deleteMapPreset,
    downloadSelectedContainersJson,
    draftMapHeight,
    draftMapWidth,
    draftTopologyMode,
    duplicateMapPreset,
    editStructure,
    edgeEditMode,
    edgeThicknessRatio,
    editableBatchComponentGroups,
    effectiveBatchComponentTypeToCreate,
    effectiveBatchComponentTypeToEdit,
    effectiveBatchEntityGroupType,
    effectiveBatchEntityTypeToCreate,
    effectiveEntityTypeToAdd,
    entityViewMode,
    fittedMapScale,
    fogEnabled,
    handleCanvasSelectionsChange,
    handleEntityMove,
    hasUnsavedCurrentPreset,
    jumpToPanelSection,
    largeSelectionJsonRequiresConfirmation,
    map,
    mapDocument,
    mapHeight,
    mapPresets,
    mapScale,
    mapStore,
    mapViewportRef,
    mapWidth,
    minCanvasHeight,
    minCanvasWidth,
    navigatingWorkspace,
    newPresetKey,
    newPresetName,
    options,
    panelWorkspace,
    panelScrollRef,
    patternRendering,
    patterns,
    pendingMutationPlan,
    presetError,
    presetKeyDraft,
    presetMessage,
    presetReloading,
    presetSaving,
    redoMutationPlan,
    renameCurrentPreset,
    reloadCurrentPreset,
    removeComponentById,
    removeEntityById,
    removeSelectedContainer,
    reset,
    saveMapPresets,
    selectMapPreset,
    selectEntity,
    selectEntityAt,
    selectedComponentId,
    selectedContainerData,
    selectedContainersJsonText,
    selectedEntity,
    selectedEntityId,
    selectedSuite,
    selectionCountSummary,
    selectionHasTarget,
    selectionJsonCollapsed,
    selectionJsonMessage,
    selectionMode,
    setBatchComponentSlotDraft,
    setBatchComponentTypeToCreate,
    setBatchComponentTypeToEdit,
    setBatchEntityArchetypeDraft,
    setBatchEntityGroupType,
    setBatchEntityTypeToCreate,
    setCanvasOuterPadding,
    setCellSize,
    setCollapsedPanelIds,
    setComponentTypeToAdd,
    setDraftMapHeight,
    setDraftMapWidth,
    setDraftTopologyMode,
    setEdgeEditMode,
    setEdgeThicknessRatio,
    setEntityTypeToAdd,
    setEntityViewMode,
    setFogEnabled,
    setMapScale,
    setMinCanvasHeight,
    setMinCanvasWidth,
    setNewPresetKey,
    setNewPresetName,
    setPatternRendering,
    setPatterns,
    setPresetKeyDraft,
    setSelectedComponentId,
    setSelectedEntityId,
    setSelectedSuite,
    setSharedEdgeThicknessRatio,
    setShowCoordinates,
    setShowGrid,
    setStructureColumnIndex,
    setStructureRowIndex,
    sharedEdgeThicknessRatio,
    showCoordinates,
    showGrid,
    structureSelection,
    suites,
    targetColumn,
    targetRow,
    toggleCollapsedId,
    toggleSelectionJson,
    topologyShellCleanupPreview,
    undoMutationPlan,
    uniqueBatchSelections,
    updateComponentById,
    updateEntityById,
    validationIssues,
  } = model;

const renderComponentCard = (entity: IEntity, component: IComponent) => {
    const definition = COMPONENT_REGISTRY.get(component.type);
    const entityDefinition = ENTITY_TYPE_REGISTRY.get(entity.entityType);
    const isRequired = entityDefinition?.requiredComponents?.includes(component.type) === true;
    const isAllowed = definition ? COMPONENT_REGISTRY.canAttachTo(component.type, entity.entityType) : false;
    const setField = (field: ComponentFieldSchema, value: unknown) => updateComponentById(
      entity.id, component.id, `修改 ${definition?.label ?? component.type} · ${field.label}`,
      (current) => valueWithPath(current, field.path, value),
    );
    return <div className="component-card" key={component.id}>
      <div className="component-card__header"><span className="inspector-heading"><strong>{definition?.label ?? component.type}</strong><small>{component.type} · v{component.version}{!isAllowed ? ' · 当前 Entity 类型不允许' : ''}</small></span><label className="component-enabled"><input type="checkbox" checked={component.enabled !== false} onChange={(event) => updateComponentById(entity.id, component.id, `切换 ${definition?.label ?? component.type} 启用状态`, (current) => ({ ...current, enabled: event.target.checked }))} />启用</label></div>
      {definition ? <div className="physics-fields">
        {definition.fields.map((field) => {
          const currentValue = valueAtPath(component, field.path);
          if (field.control === 'checkbox') return <label className="physics-check" key={field.path}><input type="checkbox" checked={currentValue === true} onChange={(event) => setField(field, event.target.checked)} /><span>{field.label}</span></label>;
          if (field.control === 'multi-select') {
            const selected = Array.isArray(currentValue) ? currentValue.filter((value): value is string => typeof value === 'string') : [];
            return <fieldset className="component-multi-select" key={field.path}><legend>{field.label}</legend>{field.options?.map((option) => <label className="physics-check" key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => setField(field, event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} /><span>{option.label}</span></label>)}</fieldset>;
          }
          if (field.control === 'select') return <label key={field.path}><span>{field.label}</span><select value={String(currentValue ?? '')} disabled={!field.options?.length} onChange={(event) => { const value = event.target.value; if (value === '' && field.optional) setField(field, undefined); else if (field.options?.some((option) => option.value === value)) setField(field, value); }}>{field.optional ? <option value="">不启用</option> : null}{!field.options?.length ? <option value="">没有可选固定值</option> : null}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
          if (field.control === 'tags') return <label key={`${field.path}-${JSON.stringify(currentValue)}`}><span>{field.label}</span><textarea rows={2} defaultValue={Array.isArray(currentValue) ? currentValue.join(', ') : ''} placeholder={field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; setField(field, event.currentTarget.value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean)); delete event.currentTarget.dataset.dirty; }} /></label>;
          if (field.control === 'json') return <label key={`${component.id}-${field.path}-${JSON.stringify(currentValue)}`}><span>{field.label}</span><textarea rows={4} defaultValue={currentValue === undefined ? '' : JSON.stringify(currentValue, null, 2)} placeholder={field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; const text = event.currentTarget.value.trim(); try { event.currentTarget.setCustomValidity(''); setField(field, text ? JSON.parse(text) : undefined); delete event.currentTarget.dataset.dirty; } catch { event.currentTarget.setCustomValidity('请输入合法 JSON'); event.currentTarget.reportValidity(); } }} /></label>;
          if (field.control === 'number') return <label key={`${field.path}-${String(currentValue)}`}><span>{field.label}</span><input type="number" min={field.min} max={field.max} step={field.step ?? 1} defaultValue={typeof currentValue === 'number' ? currentValue : ''} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; setField(field, event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value)); delete event.currentTarget.dataset.dirty; }} /></label>;
          return <label key={`${field.path}-${String(currentValue)}`}><span>{field.label}</span><input defaultValue={String(currentValue ?? '')} placeholder={field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; setField(field, event.currentTarget.value || undefined); delete event.currentTarget.dataset.dirty; }} /></label>;
        })}
      </div> : <label className="unknown-component-json"><span>未注册组件，使用原始 JSON 编辑</span><textarea key={`${component.id}-${JSON.stringify(component)}`} rows={8} defaultValue={JSON.stringify(component, null, 2)} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; try { const parsed = JSON.parse(event.currentTarget.value) as IComponent; if (!parsed.id || !parsed.type || !parsed.version) throw new Error(); event.currentTarget.setCustomValidity(''); updateComponentById(entity.id, component.id, `修改未注册 Component：${component.type}`, () => parsed); delete event.currentTarget.dataset.dirty; } catch { event.currentTarget.setCustomValidity('必须包含合法的 id、type、version'); event.currentTarget.reportValidity(); } }} /></label>}
      <details className="inspector-advanced"><summary>高级设置与操作</summary><div className="inspector-advanced__body"><div className="component-instance-meta"><label><span>Component Slot</span><input key={`${component.id}-slot-${component.slot ?? ''}`} defaultValue={component.slot ?? ''} placeholder="多实例跨 Entity 匹配键" onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; updateComponentById(entity.id, component.id, '修改 Component Slot', (current) => ({ ...current, slot: event.currentTarget.value || undefined })); delete event.currentTarget.dataset.dirty; }} /></label></div><button type="button" className="danger-button compact-button" disabled={isRequired} onClick={() => removeComponentById(entity.id, component.id)}>{isRequired ? '必需组件，不能删除' : '删除 Component'}</button></div></details>
    </div>;
  };

const renderBatchField = (field: ComponentFieldSchema) => {
    const fieldState = resolveBatchFieldValue(activeBatchComponents, field);
    const currentValue = fieldState.state === 'same' ? fieldState.value : undefined;
    const mixed = fieldState.state === 'mixed';
    const editable = field.batch?.editable === true;
    const status = mixed ? '多个值' : fieldState.state === 'missing' ? '未设置' : undefined;
    if (!editable) return <div className="batch-readonly-field" key={field.path}><span>{field.label}</span><strong>{status ?? JSON.stringify(currentValue)}</strong><em>只读 · 字段未声明批量兼容</em></div>;
    if (field.control === 'checkbox') return <label className="physics-check batch-field" key={field.path}><input type="checkbox" checked={currentValue === true} ref={(element) => { if (element) element.indeterminate = mixed; }} onChange={(event) => batchSetComponentField(field, event.target.checked)} /><span>{field.label}{status ? <em>{status}</em> : null}</span></label>;
    if (field.control === 'multi-select') {
      const selected = Array.isArray(currentValue) ? currentValue.filter((value): value is string => typeof value === 'string') : [];
      return <fieldset className="component-multi-select batch-field" key={field.path}><legend>{field.label}{status ? <em>{status}</em> : null}</legend>{field.options?.map((option) => <label className="physics-check" key={option.value}><input type="checkbox" checked={!mixed && selected.includes(option.value)} ref={(element) => { if (element) element.indeterminate = mixed; }} onChange={(event) => batchSetComponentField(field, event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} /><span>{option.label}</span></label>)}</fieldset>;
    }
    if (field.control === 'select') return <label className="batch-field" key={field.path}><span>{field.label}{status ? <em>{status}</em> : null}</span><select value={mixed ? '__mixed__' : String(currentValue ?? '')} disabled={!field.options?.length} onChange={(event) => { const value = event.target.value; if (value === '' && field.optional) batchSetComponentField(field, undefined); else if (field.options?.some((option) => option.value === value)) batchSetComponentField(field, value); }}>{mixed ? <option value="__mixed__" disabled>多个值（选择后覆盖全部）</option> : null}{field.optional ? <option value="">不启用</option> : null}{!field.options?.length ? <option value="">没有可选固定值</option> : null}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    if (field.control === 'json') return <label className="batch-field" key={`${field.path}-${fieldState.state}-${JSON.stringify(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><textarea rows={4} defaultValue={currentValue === undefined ? '' : JSON.stringify(currentValue, null, 2)} placeholder={mixed ? '多个值；输入后覆盖全部目标' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; const text = event.currentTarget.value.trim(); try { event.currentTarget.setCustomValidity(''); batchSetComponentField(field, text ? JSON.parse(text) : undefined); delete event.currentTarget.dataset.dirty; } catch { event.currentTarget.setCustomValidity('请输入合法 JSON'); event.currentTarget.reportValidity(); } }} /></label>;
    if (field.control === 'tags') return <label className="batch-field" key={`${field.path}-${fieldState.state}-${JSON.stringify(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><textarea rows={2} defaultValue={Array.isArray(currentValue) ? currentValue.join(', ') : ''} placeholder={mixed ? '多个值；输入后覆盖全部目标' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; batchSetComponentField(field, event.currentTarget.value.split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean)); delete event.currentTarget.dataset.dirty; }} /></label>;
    if (field.control === 'number') return <label className="batch-field" key={`${field.path}-${fieldState.state}-${String(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><input type="number" min={field.min} max={field.max} step={field.step ?? 1} defaultValue={typeof currentValue === 'number' ? currentValue : ''} placeholder={mixed ? '多个值' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; batchSetComponentField(field, event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value)); delete event.currentTarget.dataset.dirty; }} /></label>;
    return <label className="batch-field" key={`${field.path}-${fieldState.state}-${String(currentValue)}`}><span>{field.label}{status ? <em>{status}</em> : null}</span><input defaultValue={String(currentValue ?? '')} placeholder={mixed ? '多个值；输入后覆盖全部目标' : field.placeholder} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; batchSetComponentField(field, event.currentTarget.value || undefined); delete event.currentTarget.dataset.dirty; }} /></label>;
  };

return (
    <div className="dungeon-lab">
      <aside className="dungeon-lab__panel">
        <div className="dungeon-lab__panel-scroll" ref={panelScrollRef}>
        <div className="panel-intro">
          <p className="dungeon-lab__eyebrow">CORE UI / DATA-DRIVEN</p>
          <h1>Dungeon Map Canvas</h1>
          <p className="dungeon-lab__intro">地图拓扑数据检查、可视化与编辑工具。</p>
        </div>
        <nav className="panel-workspace-tabs" aria-label="面板目录">
          <button type="button" className={`${panelWorkspace === 'project' ? 'is-current' : ''}${navigatingWorkspace === 'project' ? ' is-navigating' : ''}`} aria-current={panelWorkspace === 'project' ? 'location' : undefined} onClick={() => jumpToPanelSection('project')}><span>地图</span><small>预设与结构</small></button>
          <button type="button" className={`${panelWorkspace === 'inspector' ? 'is-current' : ''}${navigatingWorkspace === 'inspector' ? ' is-navigating' : ''}`} aria-current={panelWorkspace === 'inspector' ? 'location' : undefined} onClick={() => jumpToPanelSection('inspector')}><span>检查器</span><small>{canvasSelections.length > 1 ? `${canvasSelections.length} 项` : canvasSelection ? `${canvasSelection.x}, ${canvasSelection.y}` : '未选择'}</small></button>
          <button type="button" className={`${panelWorkspace === 'appearance' ? 'is-current' : ''}${navigatingWorkspace === 'appearance' ? ' is-navigating' : ''}`} aria-current={panelWorkspace === 'appearance' ? 'location' : undefined} onClick={() => jumpToPanelSection('appearance')}><span>外观</span><small>主题与视图</small></button>
        </nav>
        <section id="lab-project-section" className="control-card panel-section panel-section--project">
          <div className="status-row"><span>地图结构</span><strong>{validationIssues.length === 0 ? '校验通过' : `${validationIssues.length} 项错误`}</strong></div>
          <div className="status-row"><span>公用边</span><strong>{map.sharedEdges?.length ?? 0} 条</strong></div>
          <div className="status-row"><span>公用点</span><strong>{map.sharedPoints?.length ?? 0} 个</strong></div>
          <div className="status-row"><span>当前坐标</span><strong>{canvasSelection ? `${canvasSelection.x}, ${canvasSelection.y}` : '未选择'}</strong></div>
        </section>
        <section className="control-card controls map-preset-controls panel-section--project">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('map-presets')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'map-presets')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('map-presets') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>地图预设</strong><small>拓扑参数只在新建时生效</small></span></button><strong>{Object.keys(mapPresets).length} 个</strong></div>
          {!collapsedPanelIds.has('map-presets') ? <div className="collapsible-panel-body">
          <label>当前预设<select value={activePresetKey} disabled={Object.keys(mapPresets).length === 0} onChange={(event) => selectMapPreset(event.target.value)}>{Object.keys(mapPresets).length === 0 ? <option value="">暂无已保存预设</option> : null}{Object.values(mapPresets).map((preset) => <option key={preset.presetKey} value={preset.presetKey}>{preset.name} · {preset.presetKey}</option>)}</select></label>
          {activePresetKey && mapPresets[activePresetKey] ? <><label>presetKey（按确认才生效）<span className="preset-key-row"><input value={presetKeyDraft} placeholder="输入新的 presetKey" onChange={(event) => setPresetKeyDraft(event.target.value)} /><button type="button" disabled={presetKeyDraft.trim() === activePresetKey} onClick={confirmPresetKeyChange}>确认修改 ID</button></span></label><label>当前预设名称<input value={mapPresets[activePresetKey].name} onChange={(event) => renameCurrentPreset(event.target.value)} /></label><div className="preset-actions"><button type="button" onClick={duplicateMapPreset}>复制当前预设</button><button type="button" className="danger-button" onClick={deleteMapPreset}>删除当前预设</button></div></> : null}
          <div className="preset-divider"><span>新地图参数</span><small>当前地图：{mapWidth} × {mapHeight}</small></div>
          <div className="map-size-fields">
            <label>地图 X<input type="number" min="1" max="30" value={draftMapWidth} onChange={(event) => setDraftMapWidth(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /></label>
            <label>地图 Y<input type="number" min="1" max="30" value={draftMapHeight} onChange={(event) => setDraftMapHeight(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /></label>
          </div>
          <label>拓扑模式<select value={draftTopologyMode} onChange={(event) => setDraftTopologyMode(event.target.value as DungeonMapTopologyMode)}><option value="bounded">有界模式</option><option value="loop-horizontal">左右循环</option><option value="loop-vertical">上下循环</option><option value="loop">双向循环</option></select></label>
          <div className="map-size-fields">
            <label>新预设 Key<input value={newPresetKey} onChange={(event) => setNewPresetKey(event.target.value)} /></label>
            <label>显示名称<input value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} /></label>
          </div>
          <button type="button" className="create-preset-button" onClick={createMapPreset}>新建地图预设</button>
          <div className="preset-save-actions">
            <button type="button" className="reload-preset-button" disabled={!activePresetKey || presetReloading} onClick={() => void reloadCurrentPreset()}>{presetReloading ? '正在重新加载…' : '重新加载当前预设'}</button>
            <button type="button" className="save-preset-button" disabled={presetSaving} onClick={() => void saveMapPresets()}>{presetSaving ? '正在保存…' : '保存全部地图预设'}</button>
          </div>
          <button type="button" disabled={!mapDocument || topologyShellCleanupPreview.entityCount === 0} onClick={cleanupGeneratedTopologyShells}>清理自动生成的拓扑占位 Entity</button>
          <small>{topologyShellCleanupPreview.entityCount > 0 ? `当前可安全清理 ${topologyShellCleanupPreview.entityCount} 个 Entity / ${topologyShellCleanupPreview.componentCount} 个 Component；操作可撤销。` : '当前地图没有检测到自动生成的拓扑占位 Entity。'}</small>
          {activePreset ? <div className={`preset-dirty-state${hasUnsavedCurrentPreset ? ' is-dirty' : ''}`}>{hasUnsavedCurrentPreset ? '当前预设存在尚未保存到 config 的修改' : '当前预设与最近加载 / 保存的版本一致'}</div> : null}
          <div className={`preset-status${presetError ? ' is-error' : ''}`}>{presetMessage}</div>
          </div> : null}
        </section>
        <section className="control-card controls map-structure-controls panel-section--project">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('map-structure')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'map-structure')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('map-structure') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>地图结构</strong><small>整行 / 整列修改仅保存在当前页面</small></span></button><strong>{map.width} × {map.height}</strong></div>
          {!collapsedPanelIds.has('map-structure') ? <div className="collapsible-panel-body">
            <div className="map-structure-target">
              <span>操作基准</span>
              <strong>第 {targetRow + 1} 行 · 第 {targetColumn + 1} 列</strong>
              <small>{structureSelection ? '跟随 Canvas 当前选中坐标' : 'Canvas 未选中格子，使用下方手动坐标'}</small>
            </div>
            {!structureSelection ? <div className="map-size-fields">
              <label>目标行（从 1 开始）<input type="number" min="1" max={map.height} value={targetRow + 1} onChange={(event) => setStructureRowIndex(Math.max(0, Math.min(map.height - 1, Number(event.target.value) - 1 || 0)))} /></label>
              <label>目标列（从 1 开始）<input type="number" min="1" max={map.width} value={targetColumn + 1} onChange={(event) => setStructureColumnIndex(Math.max(0, Math.min(map.width - 1, Number(event.target.value) - 1 || 0)))} /></label>
            </div> : null}
            <div className="map-structure-group">
              <span>行操作</span>
              <div className="map-structure-actions">
                <button type="button" disabled={!mapDocument} onClick={() => editStructure('insert-row-above')}>上方插入一行</button>
                <button type="button" disabled={!mapDocument} onClick={() => editStructure('insert-row-below')}>下方插入一行</button>
                <button type="button" className="danger-button" disabled={!mapDocument || map.height <= 1} onClick={() => editStructure('delete-row')}>删除当前行</button>
              </div>
            </div>
            <div className="map-structure-group">
              <span>列操作</span>
              <div className="map-structure-actions">
                <button type="button" disabled={!mapDocument} onClick={() => editStructure('insert-column-left')}>左侧插入一列</button>
                <button type="button" disabled={!mapDocument} onClick={() => editStructure('insert-column-right')}>右侧插入一列</button>
                <button type="button" className="danger-button" disabled={!mapDocument || map.width <= 1} onClick={() => editStructure('delete-column')}>删除当前列</button>
              </div>
            </div>
            <div className="map-structure-note">删除含玩家 Spawn 的行或列会被阻止；删除入口、出口、阻碍或 Marker 前会先列出影响并请求确认。</div>
          </div> : null}
        </section>
        <section id="lab-appearance-section" className="control-card controls visual-controls panel-section panel-section--appearance">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('visual')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'visual')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('visual') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>视觉参数</strong><small>仅改变 Lab 显示，不重建地图数据</small></span></button></div>
          {!collapsedPanelIds.has('visual') ? <div className="collapsible-panel-body">
          <label>格子尺寸 <strong>{cellSize}px</strong><input type="range" min="24" max="128" value={cellSize} onChange={(event) => setCellSize(Number(event.target.value))} /></label>
          <label>地图外侧留白 <strong>{canvasOuterPadding}px</strong><input type="range" min="0" max="160" step="4" value={canvasOuterPadding} onChange={(event) => setCanvasOuterPadding(Number(event.target.value))} /></label>
          <div className="map-size-fields">
            <label>最小画布宽度<input type="number" min="0" max="2400" step="20" value={minCanvasWidth} onChange={(event) => setMinCanvasWidth(Math.max(0, Math.min(2400, Number(event.target.value) || 0)))} /></label>
            <label>最小画布高度<input type="number" min="0" max="2400" step="20" value={minCanvasHeight} onChange={(event) => setMinCanvasHeight(Math.max(0, Math.min(2400, Number(event.target.value) || 0)))} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={fogEnabled} onChange={(event) => setFogEnabled(event.target.checked)} />探索迷雾</label>
          <label className="check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />显示网格</label>
          <label className="check"><input type="checkbox" checked={showCoordinates} onChange={(event) => setShowCoordinates(event.target.checked)} />显示坐标</label>
          <button type="button" className="reset-button" onClick={reset}>重置编辑数据</button>
          </div> : null}
        </section>
        <section id="lab-inspector-section" className="control-card selection-panel panel-section panel-section--inspector">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('selection')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'selection')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('selection') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>选中数据</strong><small>左键框选；右键点击或框选取消</small></span></button><strong>{canvasSelections.length === 0 ? '未选择' : canvasSelections.length > 1 ? `${canvasSelections.length} 项` : `${canvasSelection!.x}, ${canvasSelection!.y}`}</strong></div>
          {!collapsedPanelIds.has('selection') ? <div className="collapsible-panel-body">
          {canvasSelections.length === 0 ? <div className="editor-empty">当前没有选中任何数据容器，可在地图上点击或框选。</div> : canvasSelections.length > 1 ? <>
            <div className="selection-overview"><strong>已选择 {uniqueBatchSelections.length} 个数据容器</strong><span>{selectionCountSummary}</span></div>
            <div className="selection-object-list">
              <div className="selection-object-list__header"><strong>选中对象列表</strong><span>已按真实容器 ID 去重</span></div>
              {uniqueBatchSelections.slice(0, SELECTION_LIST_PREVIEW_LIMIT).map(({ selection: item, target }) => <div className="selection-object-list__item" key={target.id}><span className="selection-object-list__marker">●</span><span className="selection-object-list__text"><strong>{selectionObjectLabel(item)}</strong><small>{selectionObjectId(item)}</small></span><button type="button" className="selection-object-list__remove" title={`取消选择 ${selectionObjectLabel(item)}`} aria-label={`取消选择 ${selectionObjectLabel(item)}`} onClick={() => removeSelectedContainer(target.id)}>−</button></div>)}
              {uniqueBatchSelections.length > SELECTION_LIST_PREVIEW_LIMIT ? <div className="selection-object-list__overflow">仅预览前 {SELECTION_LIST_PREVIEW_LIMIT} 项，另有 {uniqueBatchSelections.length - SELECTION_LIST_PREVIEW_LIMIT} 项仍参与批量操作与导出。</div> : null}
            </div>
            <div className="selection-multi-hint">下方 JSON 包含全部选中数据容器；循环拓扑的重复画布位置只导出一次。</div>
          </> : <div className="selection-summary"><span>类型：{SELECTION_MODE_LABEL[canvasSelection!.mode]}</span>{canvasSelection!.direction&&canvasSelection!.mode!=='point'?<span>方向：{DIRECTION_LABEL[canvasSelection!.direction]}</span>:null}</div>}
          <div className="selection-data-panel">
            <button type="button" className="selection-data-panel__header" aria-expanded={!selectionJsonCollapsed} onClick={toggleSelectionJson}>
              <span>{selectionJsonCollapsed ? '▸' : '▾'}</span>
              <strong>全部选中容器 JSON</strong>
              <small>{uniqueBatchSelections.length} 个容器{currentLoadedLargeSelectionJson ? ' · 已加载' : largeSelectionJsonRequiresConfirmation ? ' · 展开需确认' : ''}</small>
            </button>
            {!selectionJsonCollapsed ? <>
              <div className="selection-json-actions"><div><button type="button" onClick={copySelectedContainersJson}>复制 JSON</button><button type="button" onClick={downloadSelectedContainersJson}>下载 JSON</button></div><span>{selectionJsonMessage}</span></div>
              <pre className="selection-data">{selectedContainersJsonText}</pre>
            </> : null}
          </div>
          </div> : null}
        </section>
        <section className="control-card entity-component-editor panel-section--inspector">
          <div className="map-editor__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('entity-component')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'entity-component')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('entity-component') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>Entity / Component</strong><small>{ENTITY_TYPE_DEFINITIONS.length} 种 Entity / {COMPONENT_DEFINITIONS.length} 种 Component 定义已自动扫描</small></span></button><strong>{canvasSelections.length > 1 ? `${canvasSelections.length} 个目标` : `${selectedContainerData?.entities.length ?? 0} Entity`}</strong></div>
          {!collapsedPanelIds.has('entity-component') ? <div className="collapsible-panel-body">
          {canvasSelections.length > 1 ? <div className="batch-editor">
            <div className="batch-edit-placeholder"><strong>批量编辑模式</strong><span>真实目标：{batchContainerTargets.length} 个数据容器</span><p>循环地图的重复视觉位置已按真实容器 ID 去重，所有写入均要求全部目标兼容。</p></div>
            {pendingMutationPlan ? <section className="batch-plan-preview"><div className="batch-section__title"><strong>待确认：{pendingMutationPlan.plan.label}</strong><span>{pendingMutationPlan.plan.summary.changedContainers} 个真实容器</span></div><div className="batch-plan-summary"><span>Entity ＋{pendingMutationPlan.plan.summary.createdEntities} / −{pendingMutationPlan.plan.summary.deletedEntities}</span><span>Component ＋{pendingMutationPlan.plan.summary.createdComponents} / −{pendingMutationPlan.plan.summary.deletedComponents}</span><span>阻止 {pendingMutationPlan.plan.blockedReasons.length}</span></div>{pendingMutationPlan.plan.blockedReasons.length > 0 ? <div className="batch-plan-errors">{pendingMutationPlan.plan.blockedReasons.map((reason) => <div key={reason}>{reason}</div>)}</div> : null}<div className="batch-plan-targets">{pendingMutationPlan.plan.changes.slice(0, 8).map((change) => <code key={change.targetId}>{change.targetId}</code>)}{pendingMutationPlan.plan.changes.length > 8 ? <span>另有 {pendingMutationPlan.plan.changes.length - 8} 个目标</span> : null}</div><div className="batch-plan-actions"><button type="button" onClick={cancelMutationPlan}>取消</button><button type="button" className="create-preset-button" disabled={pendingMutationPlan.plan.blockedReasons.length > 0 || pendingMutationPlan.plan.changes.length === 0} onClick={confirmMutationPlan}>确认并一次提交</button></div></section> : null}
            <section className="batch-section">
              <div className="batch-section__title"><strong>批量创建 Entity</strong><span>{batchEntityDefinitions.length} 种可用</span></div>
              {batchEntityDefinitions.length > 0 ? <><div className="batch-action-row"><select aria-label="批量创建 Entity 类型" value={effectiveBatchEntityTypeToCreate} onChange={(event) => setBatchEntityTypeToCreate(event.target.value)}>{batchEntityDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select><button type="button" className="compact-button" disabled={Boolean(pendingMutationPlan)} onClick={batchCreateEntity}>生成创建计划</button></div><label className="batch-identity-field"><span>Archetype ID（跨容器匹配，可选）</span><input value={batchEntityArchetypeDraft} placeholder="例如 door:iron" onChange={(event) => setBatchEntityArchetypeDraft(event.target.value)} /></label></> : <div className="editor-empty">当前容器组合没有共同允许批量创建的 Entity 类型</div>}
            </section>
            <section className="batch-section">
              <div className="batch-section__title"><strong>目标 Entity</strong><span>按类型跨容器匹配</span></div>
              {compatibleBatchEntityGroups.length > 0 ? <select value={effectiveBatchEntityGroupType} onChange={(event) => { setBatchEntityGroupType(event.target.value); setBatchComponentTypeToCreate(''); setBatchComponentTypeToEdit(''); }}>{compatibleBatchEntityGroups.map((group) => <option key={group.key} value={group.key}>{ENTITY_TYPE_REGISTRY.get(group.entityType)?.label ?? group.entityType}{group.archetypeId ? ` · ${group.archetypeId}` : ' · 无 Archetype'} · {group.targets.length} 个</option>)}</select> : <div className="editor-empty">没有能在每个容器中唯一匹配的 Entity</div>}
              {batchEntityGroups.filter((group) => !group.compatible).length > 0 ? <div className="batch-readonly-list"><strong>只读 / 不兼容 Entity</strong>{batchEntityGroups.filter((group) => !group.compatible).map((group) => <div key={group.key}><span>{ENTITY_TYPE_REGISTRY.get(group.entityType)?.label ?? group.entityType}{group.archetypeId ? ` · ${group.archetypeId}` : ''}</span><em>{group.reason}</em></div>)}</div> : null}
            </section>
            {activeBatchEntityGroup ? <>
              <section className="batch-section">
                <div className="batch-section__title"><strong>批量添加 Component</strong><span>{batchComponentCreateDefinitions.length} 种可用</span></div>
                {batchComponentCreateDefinitions.length > 0 ? <><div className="batch-action-row"><select aria-label="批量添加 Component 类型" value={effectiveBatchComponentTypeToCreate} onChange={(event) => setBatchComponentTypeToCreate(event.target.value)}>{batchComponentCreateDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select><button type="button" className="compact-button" disabled={Boolean(pendingMutationPlan)} onClick={batchAddComponent}>生成添加计划</button></div><label className="batch-identity-field"><span>Component Slot（多实例匹配，可选）</span><input value={batchComponentSlotDraft} placeholder="例如 on-enter" onChange={(event) => setBatchComponentSlotDraft(event.target.value)} /></label></> : <div className="editor-empty">没有可安全添加到全部目标 Entity 的 Component</div>}
              </section>
              <section className="batch-section">
                <div className="batch-section__title"><strong>批量编辑 Component</strong><span>仅单实例与明确开放字段</span></div>
                {editableBatchComponentGroups.length > 0 ? <><select value={effectiveBatchComponentTypeToEdit} onChange={(event) => setBatchComponentTypeToEdit(event.target.value)}>{editableBatchComponentGroups.map((group) => <option key={group.key} value={group.key}>{COMPONENT_REGISTRY.get(group.componentType)?.label ?? group.componentType}{group.slot ? ` · Slot: ${group.slot}` : ' · 默认槽位'}</option>)}</select>{activeBatchComponentDefinition ? <div className="physics-fields batch-fields">{activeBatchComponentDefinition.fields.map(renderBatchField)}</div> : null}</> : <div className="editor-empty">共同 Component 不支持批量字段编辑，数据仍保留为只读</div>}
                {batchComponentGroups.filter((group) => !group.compatible).length > 0 ? <div className="batch-readonly-list"><strong>只读 / 不兼容 Component 槽位</strong>{batchComponentGroups.filter((group) => !group.compatible).map((group) => <div key={group.key}><span>{COMPONENT_REGISTRY.get(group.componentType)?.label ?? group.componentType}{group.slot ? ` · ${group.slot}` : ' · 无 Slot'}</span><em>{group.reason}</em></div>)}</div> : null}
              </section>
              <section className="batch-section">
                <div className="batch-section__title"><strong>共同存在的 Component</strong><span>按类型匹配，不使用实例 ID</span></div>
                <div className="batch-component-status-list">{[...new Set(batchEntityTargets.flatMap((target) => target.entity.components.map((component) => component.type)))].map((componentType) => {
                  const definition = COMPONENT_REGISTRY.get(componentType);
                  const canDelete = batchComponentDeleteDefinitions.some((item) => item.type === componentType);
                  const canEdit = batchComponentEditDefinitions.some((item) => item.type === componentType);
                  const existsEverywhere = batchEntityTargets.every((target) => target.entity.components.some((component) => component.type === componentType));
                  return <div key={componentType}><span><strong>{definition?.label ?? componentType}</strong><small>{existsEverywhere ? canEdit ? '可批量编辑' : '只读显示' : '并非所有目标都存在'}</small></span>{canDelete ? <button type="button" className="danger-button icon-button" onClick={() => batchDeleteComponent(componentType)}>删除全部同类型实例</button> : <em>{existsEverywhere ? '禁止批量删除' : '不参与批量操作'}</em>}</div>;
                })}</div>
              </section>
            </> : null}
          </div> : !selectionHasTarget ? <div className="editor-empty">当前位置没有可编辑的数据容器</div> : <div className="single-selection-inspector">
            <section className="entity-outline">
              <div className="entity-outline__header"><strong>Entities</strong><span>{selectedContainerData?.entities.length ?? 0}</span></div>
              <div className="entity-outline__list">{(selectedContainerData?.entities ?? []).map((entity) => {
                const definition = ENTITY_TYPE_REGISTRY.get(entity.entityType);
                const active = selectedEntity?.id === entity.id;
                return <button type="button" key={entity.id} className={`entity-outline__item${active ? ' is-active' : ''}`} onClick={() => selectEntity(entity.id)}><i style={{ background: definition?.labAppearance.color ?? '#94a3b8' }} /><span><strong>{entity.name || '未命名 Entity'}</strong><small>{definition?.label ?? entity.entityType} · {entity.components.length} Components</small></span><b>›</b></button>;
              })}{selectedContainerData?.entities.length === 0 ? <div className="editor-empty">当前容器中暂无 Entity</div> : null}</div>
              <div className="entity-add-row"><label className="component-toolbar__field"><span>新增 Entity 类型</span><select aria-label="新增 Entity 类型" value={effectiveEntityTypeToAdd} disabled={availableEntityDefinitions.length === 0} onChange={(event) => setEntityTypeToAdd(event.target.value)}>{availableEntityDefinitions.length === 0 ? <option value="">当前容器无可用类型</option> : null}{availableEntityDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select></label><button type="button" className="compact-button" disabled={!effectiveEntityTypeToAdd} onClick={addEntityToSelection}>＋ Entity</button></div>
            </section>
            {selectedEntity ? [selectedEntity].map((entity) => {
              const entityDefinition = ENTITY_TYPE_REGISTRY.get(entity.entityType);
              const availableComponentDefinitions = COMPONENT_REGISTRY.listForEntity(entity.entityType);
              const effectiveComponentTypeToAdd = availableComponentDefinitions.some((definition) => definition.type === componentTypeToAdd) ? componentTypeToAdd : availableComponentDefinitions[0]?.type ?? '';
              const chosen = entity.components.find((component) => component.id === selectedComponentId) ?? entity.components[0];
              return <section className="entity-inspector" key={entity.id}>
                <div className="entity-inspector__header"><span className="inspector-heading"><strong>{entity.name || '未命名 Entity'}</strong><small>{entityDefinition?.label ?? entity.entityType}</small></span><label className="component-enabled"><input type="checkbox" checked={entity.enabled !== false} onChange={(event) => updateEntityById(entity.id, '切换 Entity 启用状态', (current) => ({ ...current, enabled: event.target.checked }))} />启用</label><details className="inspector-more"><summary aria-label="Entity 更多操作">⋯</summary><div><button type="button" className="danger-button" onClick={() => removeEntityById(entity.id)}>删除 Entity</button></div></details></div>
                <div className="physics-fields entity-primary-fields"><label><span>名称</span><input key={`${entity.id}-name-${entity.name ?? ''}`} defaultValue={entity.name ?? ''} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; updateEntityById(entity.id, '修改 Entity 名称', (current) => ({ ...current, name: event.currentTarget.value || undefined })); delete event.currentTarget.dataset.dirty; }} /></label></div>
                <details className="inspector-advanced"><summary>Entity 高级设置</summary><div className="inspector-advanced__body physics-fields"><label><span>Entity ID</span><input value={entity.id} readOnly /></label><label><span>Entity 类型</span><input value={entityDefinition ? `${entityDefinition.label} (${entity.entityType})` : `未注册 (${entity.entityType})`} readOnly /></label><label><span>原型 ID</span><input key={`${entity.id}-archetype-${entity.archetypeId ?? ''}`} defaultValue={entity.archetypeId ?? ''} onInput={(event) => { event.currentTarget.dataset.dirty = 'true'; }} onBlur={(event) => { if (event.currentTarget.dataset.dirty !== 'true') return; updateEntityById(entity.id, '修改 Entity Archetype ID', (current) => ({ ...current, archetypeId: event.currentTarget.value || undefined })); delete event.currentTarget.dataset.dirty; }} /></label></div></details>
                <div className="component-outline">
                  <div className="entity-outline__header"><strong>Components</strong><span>{entity.components.length}</span></div>
                  <div className="component-outline__list">{entity.components.map((component) => {
                    const definition = COMPONENT_REGISTRY.get(component.type);
                    const required = entityDefinition?.requiredComponents?.includes(component.type) === true;
                    return <button type="button" key={component.id} className={`component-outline__item${chosen?.id === component.id ? ' is-active' : ''}`} onClick={() => setSelectedComponentId(component.id)}><i className={component.enabled === false ? 'is-disabled' : ''} /><span><strong>{definition?.label ?? component.type}</strong><small>{component.slot ? `Slot: ${component.slot}` : component.type}</small></span>{required ? <em>必需</em> : null}</button>;
                  })}{entity.components.length === 0 ? <div className="editor-empty">暂无 Component</div> : null}</div>
                  <div className="component-add-row"><label className="component-toolbar__field"><span>新增 Component</span><select aria-label={`新增 ${entity.name || entity.id} 的 Component 类型`} value={effectiveComponentTypeToAdd} disabled={availableComponentDefinitions.length === 0} onChange={(event) => setComponentTypeToAdd(event.target.value)}>{availableComponentDefinitions.length === 0 ? <option value="">当前 Entity 无可用组件</option> : null}{availableComponentDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</select></label><button type="button" className="compact-button" disabled={!effectiveComponentTypeToAdd} onClick={() => addComponentToEntity(entity.id, effectiveComponentTypeToAdd)}>＋ Component</button></div>
                </div>
                {chosen ? renderComponentCard(entity, chosen) : null}
              </section>;
            }) : null}
          </div>}
          </div> : null}
        </section>
        <section className="control-card pattern-controls panel-section--appearance">
          <div className="pattern-controls__header"><button type="button" className="panel-collapse-button" aria-expanded={!collapsedPanelIds.has('patterns')} onClick={() => toggleCollapsedId(setCollapsedPanelIds, 'patterns')}><span className="panel-collapse-button__icon">{collapsedPanelIds.has('patterns') ? '▸' : '▾'}</span><span className="panel-collapse-button__text"><strong>地图图案</strong><small>资源自动扫描自 public</small></span></button><span>{Object.keys(PATTERN_MODULES).length} 个</span></div>
          {!collapsedPanelIds.has('patterns') ? <div className="collapsible-panel-body">
          <div className="pattern-rendering-control">
            <span>地图渲染方式</span>
            <div className="edge-mode-switch" role="group" aria-label="地图渲染方式">
              <button type="button" className={patternRendering === 'canvas' ? 'is-active' : ''} onClick={() => setPatternRendering('canvas')}>Canvas 简洁模式</button>
              <button type="button" className={patternRendering === 'svg' ? 'is-active' : ''} onClick={() => setPatternRendering('svg')}>SVG 素材模式</button>
            </div>
            <small>{patternRendering === 'canvas' ? '不加载 SVG，使用程序化格子、边和点' : '加载当前素材套装，并按业务 Entity 数据染色'}</small>
          </div>
          <label className="pattern-field"><span>成套主题</span><span className="pattern-select pattern-select--without-preview">
            <select value={selectedSuite} onChange={(event) => {
              const name = event.target.value;
              setSelectedSuite(name);
              const suite = suites.find((item) => item.name === name);
              if (!suite) return;
              setPatterns((current) => ({
                ...current,
                wall: suite.wall ?? current.wall,
                floor: suite.floor ?? current.floor,
                edgeNorth: suite.edge ?? current.edgeNorth,
                edgeEast: suite.edge ?? current.edgeEast,
                edgeSouth: suite.edge ?? current.edgeSouth,
                edgeWest: suite.edge ?? current.edgeWest,
                sharedEdge: suite.sharedEdge ?? current.sharedEdge,
                sharedPoint: suite.sharedPoint ?? current.sharedPoint,
              }));
            }}>
              <option value="">自定义组合</option>
              {suites.map((suite) => <option key={suite.name} value={suite.name}>{suite.name}套装</option>)}
            </select>
          </span></label>
          <div className="pattern-grid">
            {([['walls', 'wall'], ['tiles', 'floor'], ['characters', 'player'], ['events', 'event']] as const).map(([kind, key]) => (
              <label className="pattern-field" key={kind}><span>{PATTERN_LABELS[kind]}</span><span className="pattern-select">
                <img src={patterns[key]} alt="" /><select value={patterns[key]} onChange={(event) => setPatterns((current) => ({ ...current, [key]: event.target.value }))}>
                  {options[kind].map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
                </select>
              </span></label>
            ))}
          </div>
          <div className="edge-patterns">
            <div className="edge-patterns__title"><strong>格子四边</strong><span>墙边图案设置</span></div>
            <div className="edge-size-controls">
              <label><span>单格边厚度</span><strong>{Math.round(edgeThicknessRatio * 100)}%</strong><input type="range" min="0" max="0.5" step="0.01" value={edgeThicknessRatio} onChange={(event) => setEdgeThicknessRatio(Number(event.target.value))} /></label>
              <label><span>公用边厚度</span><strong>{Math.round(sharedEdgeThicknessRatio * 100)}%</strong><input type="range" min="0" max="1" step="0.01" value={sharedEdgeThicknessRatio} onChange={(event) => setSharedEdgeThicknessRatio(Number(event.target.value))} /></label>
            </div>
            <label className="pattern-field shared-edge-field"><span>中央公用边</span><span className="pattern-select">
              <img src={patterns.sharedEdge} alt="" /><select value={patterns.sharedEdge} onChange={(event) => setPatterns((current) => ({ ...current, sharedEdge: event.target.value }))}>
                {options.sharedEdges.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
              </select>
            </span></label>
            <label className="pattern-field shared-point-field"><span>公用交汇点</span><span className="pattern-select">
              <img src={patterns.sharedPoint} alt="" /><select value={patterns.sharedPoint} onChange={(event) => setPatterns((current) => ({ ...current, sharedPoint: event.target.value }))}>
                {options.sharedPoints.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
              </select>
            </span></label>
            <div className="edge-mode-switch" role="group" aria-label="格子四边调整模式">
              <button type="button" className={edgeEditMode === 'linked' ? 'is-active' : ''} onClick={() => setEdgeEditMode('linked')}>统一调整</button>
              <button type="button" className={edgeEditMode === 'individual' ? 'is-active' : ''} onClick={() => setEdgeEditMode('individual')}>单独调整</button>
            </div>
            {edgeEditMode === 'linked' ? (
              <label className="pattern-field"><span>全部四边</span><span className="pattern-select">
                <img src={patterns.edgeNorth} alt="" /><select value={patterns.edgeNorth} onChange={(event) => {
                  const url = event.target.value;
                  setPatterns((current) => ({ ...current, edgeNorth: url, edgeEast: url, edgeSouth: url, edgeWest: url }));
                }}>
                  {options.edges.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
                </select>
              </span></label>
            ) : (
              <div className="edge-patterns__grid">
                {([['北边', 'edgeNorth'], ['东边', 'edgeEast'], ['南边', 'edgeSouth'], ['西边', 'edgeWest']] as const).map(([label, key]) => (
                  <label className="pattern-field" key={key}><span>{label}</span><span className="pattern-select">
                    <img src={patterns[key]} alt="" /><select value={patterns[key]} onChange={(event) => setPatterns((current) => ({ ...current, [key]: event.target.value }))}>
                      {options.edges.map((option) => <option key={option.url} value={option.url}>{option.label}</option>)}
                    </select>
                  </span></label>
                ))}
              </div>
            )}
          </div>
          </div> : null}
        </section>
        </div>
      </aside>
      <main className="dungeon-lab__stage">
        <div className="map-frame">
          <div className="map-frame__header editor-command-bar">
            <div className="editor-command-bar__document">
              <strong>{activePreset?.name ?? '未命名地图'}</strong>
              <span>{activePresetKey || map.id}</span>
              {hasUnsavedCurrentPreset ? <i title="存在未保存修改">● 未保存</i> : <i className="is-saved">✓ 已保存</i>}
            </div>
            <div className="editor-command-bar__selection">
              <span>显示</span>
              <div className="selection-mode-toolbar" role="group" aria-label="Entity 显示方式">
                <button type="button" className={entityViewMode === 'overview' ? 'is-active' : ''} aria-pressed={entityViewMode === 'overview'} onClick={() => setEntityViewMode('overview')}>概览</button>
                <button type="button" className={entityViewMode === 'entities' ? 'is-active' : ''} aria-pressed={entityViewMode === 'entities'} onClick={() => setEntityViewMode('entities')}>实体展开 3D</button>
              </div>
              <span>选择</span>
              <div className="selection-mode-toolbar" role="group" aria-label="Canvas 选择类型">
                {([['all', '自动'], ['map', '地图'], ['tile', '格子'], ['edge', '单格边'], ['shared', '公用边'], ['point', '公用点']] as const).map(([mode, label]) => <button type="button" key={mode} className={selectionMode === mode ? 'is-active' : ''} aria-pressed={selectionMode === mode} onClick={() => changeSelectionMode(mode)}>{label}</button>)}
              </div>
            </div>
            <div className="editor-command-bar__actions">
              <button type="button" title="撤销最近一次数据修改" disabled={!mapStore?.canUndo || Boolean(pendingMutationPlan)} onClick={undoMutationPlan}>↶</button>
              <button type="button" title="重做最近一次数据修改" disabled={!mapStore?.canRedo || Boolean(pendingMutationPlan)} onClick={redoMutationPlan}>↷</button>
              <span className={`validation-command${validationIssues.length ? ' has-errors' : ''}`} title={validationIssues[0]?.message ?? '地图校验通过'}>{validationIssues.length ? `${validationIssues.length} 项问题` : '✓ 校验通过'}</span>
              <button type="button" className="save-command" disabled={presetSaving} onClick={() => void saveMapPresets()}>{presetSaving ? '保存中…' : '保存'}</button>
              <div className="map-zoom"><button type="button" aria-label="缩小地图" onClick={() => setMapScale((scale) => Math.max(0.5, scale - 0.1))}>−</button><button type="button" className="map-zoom__value" onClick={() => setMapScale(1)} title="恢复为适配窗口">{Math.round(mapScale * 100)}%</button><button type="button" aria-label="放大地图" onClick={() => setMapScale((scale) => Math.min(2.5, scale + 0.1))}>＋</button></div>
              <details className="viewport-menu"><summary title="视图设置" aria-label="视图设置">⚙</summary><div><strong>视图设置</strong><label><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />显示网格</label><label><input type="checkbox" checked={showCoordinates} onChange={(event) => setShowCoordinates(event.target.checked)} />显示坐标</label><label><input type="checkbox" checked={fogEnabled} onChange={(event) => setFogEnabled(event.target.checked)} />探索迷雾</label><button type="button" onClick={() => jumpToPanelSection('appearance')}>跳到完整外观设置</button></div></details>
            </div>
          </div>
          <div className={`map-scroll${entityViewMode === 'entities' ? ' map-scroll--3d' : ''}`} ref={mapViewportRef}>
            {entityViewMode === 'entities' ? <DungeonMapCanvas3D
              document={mapDocument}
              map={mapDocument ? undefined : map}
              entityTypeColors={ENTITY_TYPE_COLORS}
              selections={canvasSelections}
              selectedEntityId={selectedEntityId}
              selectionMode={selectionMode}
              showGrid={showGrid}
              showCoordinates={showCoordinates}
              cellSize={cellSize}
              edgeThicknessRatio={edgeThicknessRatio}
              sharedEdgeThicknessRatio={sharedEdgeThicknessRatio}
              zoom={mapScale}
              onSelectionsChange={(next) => {
                setSelectedEntityId('');
                setSelectedComponentId('');
                handleCanvasSelectionsChange(next);
              }}
              onEntitySelect={selectEntityAt}
              onEntityMove={handleEntityMove}
            /> : <DungeonMapCanvas
              {...(mapDocument ? { document: mapDocument } : { map })}
              cellSize={cellSize}
              displayScale={fittedMapScale * mapScale}
              outerPadding={canvasOuterPadding}
              minCanvasWidth={minCanvasWidth}
              minCanvasHeight={minCanvasHeight}
              showGrid={showGrid}
              showCoordinates={showCoordinates}
              patterns={patterns}
              patternRendering={patternRendering}
              entityViewMode={entityViewMode}
              entityTypeColors={ENTITY_TYPE_COLORS}
              edgeThicknessRatio={edgeThicknessRatio}
              sharedEdgeThicknessRatio={sharedEdgeThicknessRatio}
              selectionMode={selectionMode}
              selections={canvasSelections}
              selectedEntityId={selectedEntityId}
              onSelectionsChange={handleCanvasSelectionsChange}
              onEntitySelect={selectEntityAt}
              onEntityMove={handleEntityMove}
              keyboardEnabled={false}
            />}
          </div>
          <div className="map-frame__footer editor-status-bar">
            <span>坐标 <strong>{canvasSelection ? `${canvasSelection.x}, ${canvasSelection.y}` : '—'}</strong></span>
            <span><strong>{uniqueBatchSelections.length}</strong> 个对象</span>
            <span><strong>{map.width} × {map.height}</strong></span>
            <span className={validationIssues.length ? 'has-errors' : 'is-valid'}>{validationIssues.length ? `${validationIssues.length} 项问题` : '校验通过'}</span>
            <span className={hasUnsavedCurrentPreset ? 'is-dirty' : 'is-saved'}>{hasUnsavedCurrentPreset ? '尚未保存' : '已保存'}</span>
            <details className="entity-legend-menu"><summary>Entity 图例</summary><div>{ENTITY_TYPE_DEFINITIONS.map((definition) => <span className="entity-color-legend__item" key={definition.type} title={definition.type}><i style={{ background: definition.labAppearance.color }} />{definition.label}</span>)}<span className="entity-color-legend__item" title="没有注册 Entity 类型或尚未迁移的数据"><i style={{ background: '#94a3b8' }} />未注册数据</span></div></details>
          </div>
        </div>
      </main>
    </div>
  );
};
