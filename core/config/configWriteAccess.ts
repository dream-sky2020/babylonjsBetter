/**
 * 配置写回只在开发环境可用：正式构建里配置已经内联进包体，
 * 没有可写回的磁盘文件，也不允许连接开发服务器。
 */

export const CONFIG_READ_ONLY_MESSAGE = '正式构建为只读，无法写回配置；请在开发环境（npm run dev）中保存，或导出 JSON 手动替换。';

export const isConfigWritable = (): boolean => import.meta.env.DEV;

/** 只读模式下的兜底：把当前配置导出成文件，供用户手动覆盖 `config/`。 */
export const downloadConfigJson = (fileName: string, data: unknown): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName.replace(/^.*\//, '');
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};
