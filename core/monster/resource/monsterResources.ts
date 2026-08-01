export const normalizeMonsterResourcePath = (value: unknown): string => {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith('/resources/')) return raw.slice('/resources/'.length);
  if (raw.startsWith('resources/')) return raw.slice('resources/'.length);
  return raw;
};

export const toMonsterResourceUrl = (value: unknown): string => {
  const relative = normalizeMonsterResourcePath(value);
  return relative ? encodeURI(`/resources/${relative}`) : '';
};

export const collectMonsterResourceImages = (moduleUrls: unknown[], additionalPaths: unknown[] = []): string[] => {
  const resources = new Set<string>();
  for (const value of moduleUrls) {
    const path = decodeURI(String(value || '')).replace(/^\/+/, '').replace(/^\.\/+/, '').replace(/^public\/+/, '');
    if (path.startsWith('resources/')) resources.add(path);
  }
  for (const value of additionalPaths) {
    const path = normalizeMonsterResourcePath(value);
    if (path) resources.add(`resources/${path}`);
  }
  return [...resources].sort((a, b) => a.localeCompare(b, 'zh-CN'));
};
