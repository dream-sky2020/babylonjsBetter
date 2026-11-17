const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const channel = 'checkpoint:slots';
const disk = import('../runtime/labSaveDisk.mjs');

async function prepareDirectory(directory, create) {
  if (create) await fs.mkdir(directory, { recursive: true });
  if (!(await fs.stat(directory)).isDirectory()) throw new Error('存档路径必须是文件夹。');
  await fs.access(directory, constants.R_OK | constants.W_OK);
}

function registerLabSaveStorage({ distDir, rendererBaseUrl, projectRoot }) {
  const allowedOrigin = rendererBaseUrl ? new URL(rendererBaseUrl).origin : null;
  ipcMain.handle(channel, async (event, request) => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame) throw new Error('存档目录只能由 Lab 主页面访问。');
    const sender = new URL(frame.url);
    const relative = sender.protocol === 'file:' ? path.relative(distDir, fileURLToPath(sender)) : null;
    if ((relative === null && (!allowedOrigin || sender.origin !== allowedOrigin))
      || (relative !== null && (!relative || relative.startsWith('..') || path.isAbsolute(relative)))) {
      throw new Error('当前页面不能访问存档目录。');
    }
    const { labId, action } = request ?? {};
    const { deleteSaveFile, isLabSaveLabId, readSaveText, writeSaveAtomically, listSaveFiles, readSaveFile, writeSaveFile } = await disk;
    if (!isLabSaveLabId(labId)) throw new Error('Lab ID 无效。');
    const userData = app.getPath('userData');
    const defaultDirectory = path.join(projectRoot && allowedOrigin ? projectRoot : userData, 'saves', labId);
    const settingsFile = path.join(userData, 'lab-save-directories', `${labId}.json`);
    if (action === 'reset-directory') {
      await prepareDirectory(defaultDirectory, true);
      await fs.rm(settingsFile, { force: true });
      return;
    }
    const setDirectory = async (value, create) => {
      if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) {
        throw new Error('请输入文件夹的绝对路径。');
      }
      const next = path.resolve(value);
      await prepareDirectory(next, create);
      await fs.mkdir(path.dirname(settingsFile), { recursive: true });
      await writeSaveAtomically(settingsFile, JSON.stringify(next));
    };
    if (action === 'set-directory') {
      await setDirectory(typeof request.path === 'string' ? request.path.trim() : null, true);
      return;
    }
    const customized = await readSaveText(settingsFile);
    const directory = customized ? JSON.parse(customized) : defaultDirectory;
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('存档目录设置无效。');
    if (action === 'directory') {
      try {
        await prepareDirectory(directory, !customized);
        return { path: directory, label: directory, ready: true };
      } catch {
        return { path: directory, label: '存档目录不可用，请重新选择或恢复默认。', ready: false };
      }
    }
    if (action === 'choose') {
      const window = BrowserWindow.fromWebContents(event.sender);
      const options = { title: '选择 Lab 存档目录', defaultPath: directory, properties: ['openDirectory', 'createDirectory'] };
      const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
      if (result.canceled || !result.filePaths[0]) return false;
      await setDirectory(result.filePaths[0], false);
      return true;
    }
    await prepareDirectory(directory, !customized);
    if (action === 'list') return listSaveFiles(directory, labId);
    if (action === 'read') return readSaveFile(directory, labId, request.id);
    if (action === 'write') return writeSaveFile(directory, labId, request.id, request.text, request.expectedRevision);
    if (action === 'delete') return deleteSaveFile(directory, labId, request.id, request.expectedRevision);
    throw new Error('未知的存档操作。');
  });
}

module.exports = { registerLabSaveStorage };
