import { collides } from 'react-grid-layout';
import { parseGrid, type GridData, type Panel } from './layouts.ts';

/** Reserve a top row for the battlefield overview, then move only conflicting windows down. */
export function placeBattlefieldTop(data: GridData): GridData {
  if (data.locked) return data;
  const items = data.items.map(item => ({ ...item }));

  const battlefield = items.find(item => item.i === 'battlefield')!;


  battlefield.x = 0; battlefield.y = 0; battlefield.w = 12;
  const hidden: Panel[] = data.hidden.filter(id => id !== 'battlefield');
  const placed = [battlefield];
  const remaining = items.filter(item => item.i !== 'battlefield' && !hidden.includes(item.i as Panel)).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const item of remaining) {
    let overlaps = placed.filter(other => collides(item, other));
    while (overlaps.length) {
      item.y = Math.max(...overlaps.map(other => other.y + other.h));
      overlaps = placed.filter(other => collides(item, other));
    }
    placed.push(item);
  }
  return parseGrid({ ...data, items, hidden });
}
