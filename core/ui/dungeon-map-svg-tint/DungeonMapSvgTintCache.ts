import type { IEntityContainer } from '@/core/entity';

export type DungeonMapEntityAppearance = {
  colors: readonly string[];
  mixedColor: string;
  entityTypes: readonly string[];
};

export type DungeonMapEntityTypeColors = Readonly<Record<string, string>>;

const UNKNOWN_ENTITY_COLOR = '#94a3b8';
const STRUCTURAL_ENTITY_TYPES = new Set(['map', 'tile', 'tile-edge', 'shared-edge', 'shared-point']);
const TINT_ROLES = ['base', 'primary', 'highlight', 'outline'] as const;
type TintRole = typeof TINT_ROLES[number];
const TINT_ROLE_STRENGTH: Record<TintRole, number> = {
  base: 0.28,
  primary: 0.58,
  highlight: 0.42,
  outline: 0.34,
};

const parseHexColor = (color: string): [number, number, number] | undefined => {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return undefined;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const channelToLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const channelToSrgb = (channel: number) => {
  const value = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
};

const rgbToHex = ([red, green, blue]: readonly number[]) => (
  `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
);

/** 在线性 RGB 中混合，避免普通 RGB 平均产生过暗、发脏的结果。 */
export const mixDungeonMapEntityColors = (colors: readonly string[]): string => {
  const parsed = colors.map(parseHexColor).filter((color): color is [number, number, number] => color !== undefined);
  if (parsed.length === 0) return UNKNOWN_ENTITY_COLOR;
  const linear = parsed.reduce<[number, number, number]>((sum, color) => [
    sum[0] + channelToLinear(color[0]),
    sum[1] + channelToLinear(color[1]),
    sum[2] + channelToLinear(color[2]),
  ], [0, 0, 0]);
  return rgbToHex(linear.map((channel) => channelToSrgb(channel / parsed.length)));
};

const mixTwoColors = (left: string, right: string, rightWeight: number): string => {
  const leftRgb = parseHexColor(left) ?? parseHexColor(UNKNOWN_ENTITY_COLOR)!;
  const rightRgb = parseHexColor(right) ?? parseHexColor(UNKNOWN_ENTITY_COLOR)!;
  const weight = Math.max(0, Math.min(1, rightWeight));
  return rgbToHex(leftRgb.map((channel, index) => channel * (1 - weight) + rightRgb[index] * weight));
};

const colorsForRoles = (color: string): Record<TintRole, string> => ({
  base: mixTwoColors(color, '#07100d', 0.68),
  primary: color,
  highlight: mixTwoColors(color, '#ffffff', 0.48),
  outline: mixTwoColors(color, '#000000', 0.58),
});

const hasStoredData = (value: unknown): boolean => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== 'object') return true;
  const entities = (value as Partial<IEntityContainer>).entities;
  if (Array.isArray(entities)) return entities.length > 0;
  return Object.keys(value).length > 0;
};

export const resolveDungeonMapEntityAppearance = (
  value: unknown,
  entityTypeColors: DungeonMapEntityTypeColors,
): DungeonMapEntityAppearance | undefined => {
  if (!hasStoredData(value)) return undefined;
  const entities = (value as Partial<IEntityContainer>).entities;
  if (!Array.isArray(entities)) {
    return { colors: [UNKNOWN_ENTITY_COLOR], mixedColor: UNKNOWN_ENTITY_COLOR, entityTypes: ['未注册数据'] };
  }
  const visibleEntities = entities.filter((entity) => (
    !STRUCTURAL_ENTITY_TYPES.has(entity.entityType)
    || entity.components.some((component) => component.type !== 'legacy-data')
  ));
  if (visibleEntities.length === 0) return undefined;
  const entityTypes = [...new Set(visibleEntities.map((entity) => entity.entityType || '未注册 Entity'))].sort();
  const colors = entityTypes.map((entityType) => entityTypeColors[entityType] ?? UNKNOWN_ENTITY_COLOR);
  return { colors, mixedColor: mixDungeonMapEntityColors(colors), entityTypes };
};

const loadImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = source;
});

const createTintedSvgSource = (svgText: string, color: string): string | undefined => {
  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = document.documentElement;
  if (root.tagName.toLowerCase() !== 'svg' || root.getAttribute('data-tint-schema') !== 'dungeon-map-v1') {
    return undefined;
  }
  const roleColors = colorsForRoles(color);
  root.querySelectorAll('[data-tint-role]').forEach((element) => {
    const role = element.getAttribute('data-tint-role') as TintRole | null;
    if (!role || !TINT_ROLES.includes(role)) return;
    (['fill', 'stroke'] as const).forEach((attribute) => {
      const original = element.getAttribute(attribute);
      if (!original || original === 'none') return;
      element.setAttribute(
        attribute,
        parseHexColor(original)
          ? mixTwoColors(original, roleColors[role], TINT_ROLE_STRENGTH[role])
          : roleColors[role],
      );
    });
  });
  return new XMLSerializer().serializeToString(document);
};

/** 页面内存 LRU；不进入 LabState、存档或磁盘。 */
export class DungeonMapSvgTintCache {
  private readonly entries = new Map<string, Promise<HTMLImageElement>>();
  private readonly resolved = new Map<string, HTMLImageElement>();
  private readonly sourceTexts = new Map<string, Promise<string>>();
  private readonly maximumEntries: number;

  constructor(maximumEntries = 1024) {
    this.maximumEntries = maximumEntries;
  }

  get(source: string, color: string): HTMLImageElement | undefined {
    const key = `${source}|${color.toLowerCase()}`;
    const image = this.resolved.get(key);
    if (!image) return undefined;
    this.resolved.delete(key);
    this.resolved.set(key, image);
    return image;
  }

  load(source: string, color: string): Promise<HTMLImageElement> {
    const key = `${source}|${color.toLowerCase()}`;
    const existing = this.entries.get(key);
    if (existing) return existing;
    const promise = this.loadTintedImage(source, color).then((image) => {
      if (this.entries.get(key) === promise) {
        this.resolved.set(key, image);
        this.trim();
      }
      return image;
    }).catch((error) => {
      this.entries.delete(key);
      this.resolved.delete(key);
      throw error;
    });
    this.entries.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
    this.resolved.clear();
    this.sourceTexts.clear();
  }

  private async loadTintedImage(source: string, color: string): Promise<HTMLImageElement> {
    try {
      let sourceText = this.sourceTexts.get(source);
      if (!sourceText) {
        sourceText = fetch(source).then((response) => {
          if (!response.ok) throw new Error(`SVG request failed: ${response.status}`);
          return response.text();
        });
        this.sourceTexts.set(source, sourceText);
      }
      const tintedSource = createTintedSvgSource(await sourceText, color);
      if (!tintedSource) return loadImage(source);
      const objectUrl = URL.createObjectURL(new Blob([tintedSource], { type: 'image/svg+xml' }));
      try {
        return await loadImage(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      return loadImage(source);
    }
  }

  private trim(): void {
    while (this.resolved.size > this.maximumEntries) {
      const oldest = this.resolved.keys().next().value as string | undefined;
      if (!oldest) return;
      this.entries.delete(oldest);
      this.resolved.delete(oldest);
    }
  }
}
