import { requestDevServer } from '@/core/network/devServerPortResolver.ts';

type JsonValue = unknown;

const bundledConfigModules = import.meta.glob('../../config/*.json', {
  eager: true,
  import: 'default'
}) as Record<string, JsonValue>;

const bundledConfigs = new Map<string, JsonValue>(
  Object.entries(bundledConfigModules).map(([modulePath, value]) => [
    modulePath.split('/').pop() ?? modulePath,
    value
  ])
);

const normalizeConfigFileName = (fileName: string): string =>
  fileName.replace(/\\/g, '/').replace(/^\/?config\//, '').split('/').pop() ?? fileName;

const cloneJson = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

export type ConfigLoadOptions<T> = {
  /** 开发环境下可从 Python 接口取得尚未重新构建的最新配置。 */
  devApiPath?: string;
  /** 将开发接口的响应体转换成与 JSON 文件相同的数据结构。 */
  selectDevPayload?: (payload: unknown) => T;
};

export const readBundledConfig = <T>(fileName: string): T => {
  const normalizedName = normalizeConfigFileName(fileName);
  if (!bundledConfigs.has(normalizedName)) {
    throw new Error(`打包配置不存在：${normalizedName}`);
  }
  return cloneJson(bundledConfigs.get(normalizedName) as T);
};

export const loadConfig = async <T>(
  fileName: string,
  options: ConfigLoadOptions<T> = {}
): Promise<T> => {
  if (import.meta.env.DEV && options.devApiPath) {
    try {
      const separator = options.devApiPath.includes('?') ? '&' : '?';
      const response = await requestDevServer(
        `${options.devApiPath}${separator}t=${Date.now()}`,
        { method: 'GET' }
      );
      const payload = await response.json() as unknown;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return cloneJson(options.selectDevPayload ? options.selectDevPayload(payload) : payload as T);
    } catch {
      // 开发服务未启动时仍可使用构建时收录的配置。
    }
  }

  return readBundledConfig<T>(fileName);
};

/** 迁移旧代码用：接受 `/config/example.json`，但仍从统一配置入口读取。 */
export const loadConfigFromUrl = async <T = unknown>(configUrl: string): Promise<T> =>
  loadConfig<T>(configUrl.split(/[?#]/, 1)[0]);

export const isConfigDevServerEnabled = (): boolean => import.meta.env.DEV;
