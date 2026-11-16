import { execFile } from 'node:child_process'
import { sep } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)

// Argument values reach the native dialog through environment variables and never become script text.
export async function pickImage({ title, initialDir }) {
  if (process.platform === 'win32') {
    const script = [
      '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = [Windows.Forms.OpenFileDialog]::new()',
      '$dialog.Title = $env:LAB_PICK_IMAGE_TITLE',
      '$dialog.InitialDirectory = $env:LAB_PICK_IMAGE_DIRECTORY',
      '$dialog.Filter = "Image files (*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp;*.svg)|*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp;*.svg"',
      'try { if ($dialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileName) } } finally { $dialog.Dispose() }',
    ].join('\n')
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', encoded], {
      windowsHide: true, env: { ...process.env, LAB_PICK_IMAGE_TITLE: title, LAB_PICK_IMAGE_DIRECTORY: initialDir },
    })
    return stdout
  }
  const mac = process.platform === 'darwin'
  const command = mac ? 'osascript' : 'zenity'
  const args = mac ? [
    '-e', 'on run argv',
    '-e', 'return POSIX path of (choose file with prompt (item 1 of argv) default location (POSIX file (item 2 of argv)))',
    '-e', 'end run', title, initialDir,
  ] : ['--file-selection', '--title=' + title, '--filename=' + initialDir + sep]
  try {
    const { stdout } = await execute(command, args)
    return stdout.replace(/[\r\n]+$/, '')
  } catch (error) {
    if (mac ? /\(-128\)/.test(error.stderr ?? '') : error.code === 1 && !error.stderr) return ''
    throw error
  }
}

