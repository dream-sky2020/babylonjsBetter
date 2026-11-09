import { useEffect, useState } from 'react';
import { dialogueEntryHasChoices } from '@/core/dialogue-map/dialogueMap';
import { loadDialogueEditorDocumentLibrary } from '@/core/dialogue-map/dialogueMapPresetRepository';
import { loadDialoguePreviewPresetLibrary } from '@/core/dialogue-preview/dialoguePreviewPresetRepository';
import { getDialogueUiOptions } from '@/core/dialogue-preview/dialogueUiCompatibility';
import type { IComponent } from '@/core/entity';
import type { IEventComponent } from '@/core/entity/components/event.component';

function loadCatalog() {
  return Promise.all([loadDialogueEditorDocumentLibrary(), loadDialoguePreviewPresetLibrary()]);
}
let catalogRequest: ReturnType<typeof loadCatalog> | undefined;

export function DialogueUiPresetPicker({ component, label, onChange }: {
  component: IComponent;
  label: string;
  onChange(value: string | undefined): void;
}) {
  const action = (component as IEventComponent).action;
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadCatalog>>>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const request = catalogRequest ??= loadCatalog().catch(error => { catalogRequest = undefined; throw error; });
    void request.then(value => { if (active) setCatalog(value); }, error => {
      if (active) setError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, []);

  if (action?.type !== 'dialogue') return null;
  const story = catalog?.[0][action.presetKey];
  const options = getDialogueUiOptions(catalog?.[1] ?? {}, !!story && dialogueEntryHasChoices(story, action.entryNodeId));
  const key = action.uiPresetKey ?? '';
  const selected = options.find(option => option.key === key);
  const issue = error || (key && catalog ? selected ? selected.issues.join('；') : `UI 预设不存在：${key}` : '');
  return <label><span>{label}</span><select aria-label={label} value={key} disabled={!catalog} onChange={event => onChange(event.target.value || undefined)}>
    <option value="">沿用对话模块的 UI 预设</option>
    {key && !selected && <option value={key} disabled>{catalog ? `${key}（不存在）` : key}</option>}
    {options.map(({ key, name, issues }) => <option key={key} value={key} disabled={!!issues.length}>{name} · {key}{issues.length ? `（${issues.join('；')}）` : ''}</option>)}
  </select>{issue && <small>{issue}</small>}</label>;
}
