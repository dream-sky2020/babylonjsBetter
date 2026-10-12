export type SharedDataField = { path: string; value: string };

/** Bounded flat debug fields, preserving object paths without a nested tree UI. */
export const flattenSharedData = (value: unknown, limit = 200): SharedDataField[] => {
  const fields: SharedDataField[] = [];
  const seen = new WeakSet<object>();
  let truncated = false;
  const visit = (item: unknown, path: string, depth: number) => {
    if (fields.length >= limit) { truncated = true; return; }
    const add = (text: string) => fields.push({ path: path || '值', value: text });
    if (item === null || typeof item !== 'object') {
      add(typeof item === 'string' ? item : String(item));
      return;
    }
    if (seen.has(item)) { add('[重复引用]'); return; }
    if (depth >= 8) { add('[深度已截断]'); return; }
    seen.add(item);
    if (item instanceof Date) { add(item.toISOString()); return; }
    if (item instanceof Map) { add(`Map (${item.size})`); return; }
    if (item instanceof Set) { add(`Set (${item.size})`); return; }
    if (Array.isArray(item)) {
      add(`数组 (${item.length})`);
      for (let index = 0; index < Math.min(item.length, 20); index += 1) visit(item[index], `${path}[${index}]`, depth + 1);
      if (item.length > 20 && fields.length < limit) fields.push({ path: `${path}[…]`, value: `其余 ${item.length - 20} 项未显示` });
      return;
    }
    const entries = Object.entries(item);
    if (!entries.length) { add('{}'); return; }
    for (const [key, child] of entries) {
      visit(child, path ? `${path}.${key}` : key, depth + 1);
      if (fields.length >= limit) { truncated = true; break; }
    }
  };
  visit(value, '', 0);
  if (truncated) fields.push({ path: '…', value: `最多显示 ${limit} 个字段；请缩小 inspect 摘要。` });
  return fields;
};
