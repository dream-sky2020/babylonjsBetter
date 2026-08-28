/**
 * 统一解析 public 静态资源地址。
 *
 * 开发期由 Vite 以站点根目录提供服务，正式构建后可能被 Electron 以 `file://`
 * 直接打开，此时任何以 `/` 开头的地址都会落到磁盘根目录，必须换算成相对地址。
 */

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i;

const stripLastSegment = (url: string): string => url.slice(0, url.lastIndexOf('/') + 1);

const resolveAppRootUrl = (): string => {
  if (import.meta.env.DEV) {
    const href = typeof location === 'undefined' ? 'http://localhost/' : location.href;
    return new URL('/', href).href;
  }
  // 正式构建里本模块位于 <打包根>/assets/*.js，上一级即打包根目录。
  // 这里刻意用字符串截取而非 `new URL('../', import.meta.url)`：
  // 后者会被打包器当成静态资源引用，在构建期解析成错误的内联地址。
  const assetsDirUrl = stripLastSegment(import.meta.url);
  return stripLastSegment(assetsDirUrl.slice(0, -1));
};

const appRootUrl = resolveAppRootUrl();

export const getAppRootUrl = (): string => appRootUrl;

/** 去掉站点前缀、前导斜杠与 `public/`，得到相对打包根目录的路径。 */
export const normalizeAppAssetPath = (input: unknown): string => {
  const raw = String(input ?? '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, '');
  return withoutOrigin.replace(/^\/+/, '').replace(/^\.\/+/, '').replace(/^public\/+/, '');
};

/**
 * 把 `/resources/a.png`、`resources/a.png`、`public/resources/a.png` 之类的写法
 * 换算成当前运行环境可用的绝对 URL；已经是完整 URL（http、data、blob）时原样返回。
 */
export const resolveAppAssetUrl = (input: unknown): string => {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  if (ABSOLUTE_URL_PATTERN.test(raw)) return raw;
  const relativePath = normalizeAppAssetPath(raw);
  if (!relativePath) return '';
  return new URL(relativePath, appRootUrl).href;
};

/** 与 `resolveAppAssetUrl` 相同，但会补齐 `resources/` 前缀。 */
export const resolvePublicResourceUrl = (input: unknown): string => {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  if (ABSOLUTE_URL_PATTERN.test(raw)) return raw;
  const relativePath = normalizeAppAssetPath(raw);
  if (!relativePath) return '';
  const withPrefix = relativePath.startsWith('resources/') ? relativePath : `resources/${relativePath}`;
  return new URL(withPrefix, appRootUrl).href;
};
