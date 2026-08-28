/**
 * 以 file:// 打开构建产物，收集控制台报错与失败请求。
 * 用法：npm run verify:file
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, '..', 'dist');

const collectHtmlPages = (dir = distDir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'resources' ? [] : collectHtmlPages(absPath);
    if (!entry.name.endsWith('.html')) return [];
    return [path.relative(distDir, absPath).split(path.sep).join('/')];
  });

const pages = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const targets = pages.length ? pages : collectHtmlPages();

const SETTLE_MS = 4000;

const inspectPage = async (relativePath) => {
  const errors = [];
  const failedRequests = [];
  const window = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { offscreen: true } });

  window.webContents.on('console-message', (event) => {
    if (event.level !== 'error' && event.level !== 'warning') return;
    if (event.message.includes('Electron Security Warning')) return;
    errors.push(event.message);
  });
  window.webContents.session.webRequest.onErrorOccurred((details) => {
    failedRequests.push(`${details.error} ${details.url}`);
  });

  try {
    await window.loadFile(path.join(distDir, relativePath));
  } catch (error) {
    errors.push(`加载失败：${error && error.message ? error.message : String(error)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  window.destroy();
  return { relativePath, errors, failedRequests };
};

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
// 逐页检查时窗口会被反复销毁，默认的「关闭所有窗口即退出」会中断检查。
app.on('window-all-closed', () => undefined);
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  let failures = 0;
  for (const relativePath of targets) {
    const result = await inspectPage(relativePath);
    const problems = [...result.errors, ...result.failedRequests];
    if (problems.length === 0) {
      console.log(`[OK]   ${relativePath}`);
      continue;
    }
    failures += 1;
    console.log(`[FAIL] ${relativePath}`);
    for (const problem of problems.slice(0, 20)) console.log(`       ${problem}`);
    if (problems.length > 20) console.log(`       …还有 ${problems.length - 20} 条`);
  }
  console.log(failures === 0 ? '所有页面在 file:// 下无报错' : `${failures} 个页面存在问题`);
  app.exit(failures === 0 ? 0 : 1);
});
