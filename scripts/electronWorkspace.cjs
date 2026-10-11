const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const resolveRepoPath = (...parts) => path.resolve(repositoryRoot, ...parts);
// Windows spelling initialization can write malformed relative paths under the
// Codex sandbox. Keep those writes outside the repository, even for direct runs.
const workDirectory = process.env.BABYLON_ELECTRON_WORKDIR ||
  fs.mkdtempSync(path.join(os.tmpdir(), 'babylon-electron-'));
process.chdir(workDirectory);
if (!process.env.BABYLON_ELECTRON_WORKDIR) {
  process.once('exit', () => {
    process.chdir(os.tmpdir());
    if (path.dirname(path.resolve(workDirectory)) !== path.resolve(os.tmpdir()) ||
        !path.basename(workDirectory).startsWith('babylon-electron-')) return;
    try { fs.rmSync(workDirectory, { recursive: true, force: true, maxRetries: 3 }); }
    catch (error) { console.warn(`Could not remove Electron temporary directory: ${error.message}`); }
  });
}
module.exports = { resolveRepoPath };
