import bundledPublicAssets from 'virtual:app-public-assets';

/** 只列出 public 路径；图片由 public 复制，避免再次导入、读取和打包图片内容。 */
export const readBundledPublicAssetPaths = (extensionPattern?: RegExp): string[] =>
  bundledPublicAssets.filter((path) => {
    if (!extensionPattern) return true;
    extensionPattern.lastIndex = 0;
    return extensionPattern.test(path);
  });

/** 保持旧图片目录的键值形状，值为根目录相对路径，交给 resolveAppAssetUrl 使用。 */
export const readBundledPublicImageModules = (resourceOnly = false): Record<string, string> =>
  Object.fromEntries(readBundledPublicAssetPaths(/\.(?:png|jpe?g|webp|gif|avif|svg)$/i)
    .filter((path) => !resourceOnly || path.startsWith('/resources/'))
    .map((path) => [`/public${path}`, path]));
