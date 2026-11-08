import type { ComponentFieldSchema } from '@/core/entity';
import './entity-container-editor.css';

export function InteractionDirectionPicker({ field, value, onChange }: {
  field: ComponentFieldSchema; value: unknown; onChange(value: string[]): void;
}) {
  const selected = Array.isArray(value) ? value as string[] : [];
  const positions: Record<string, string> = { north: '1 / 2', front: '1 / 2', east: '2 / 3', right: '2 / 3',
    south: '3 / 2', back: '3 / 2', west: '2 / 1', left: '2 / 1' };
  return <fieldset className="ece-direction-picker"><legend>{field.label}</legend><div>
    <span className="ece-direction-center">{field.path === 'localSides' ? '↑ 正面' : '地图'}</span>
    {field.options?.map(option => <label key={option.value} style={{ gridArea: positions[option.value] }}>
      <input type="checkbox" checked={selected.includes(option.value)} onChange={event => onChange(event.target.checked
        ? [...selected, option.value] : selected.filter(value => value !== option.value))} />{option.label}
    </label>)}
  </div></fieldset>;
}
