import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDungeonMapDocumentV2 } from '../core/map-document/dungeonMapDocument.codec.ts';
import { parseDungeonMapDocumentV3 } from '../core/map-document/dungeonMapDocument.storageV3.ts';
import { migrateDungeonSpatialDefinitions } from '../core/map-document/dungeonMapDocument.spatialMigration.ts';

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--'));
const output = args.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
const report = args.find(arg => arg.startsWith('--report='))?.slice('--report='.length);
if (!input || args.some(arg => arg.startsWith('--') && arg !== '--dry-run' && !arg.startsWith('--output=') && !arg.startsWith('--report='))) {
  throw new Error('用法：npm run migrate:dungeon-spatial -- INPUT [--dry-run] [--output=NEW_FILE] [--report=NEW_FILE]');
}
const paths = [input, output, report].filter((value): value is string => !!value).map(value => resolve(value).toLowerCase());
if (new Set(paths).size !== paths.length) throw new Error('输入、输出与报告必须使用不同路径。');
for (const target of [output, report]) if (target && existsSync(target)) throw new Error(`拒绝覆盖已有文件：${target}`);
const stored = JSON.parse(readFileSync(input, 'utf8'));
const source = stored.schemaVersion === 3 ? parseDungeonMapDocumentV3(stored) : parseDungeonMapDocumentV2(stored);
const result = migrateDungeonSpatialDefinitions(source);
const summary = {
  input: resolve(input), output: output ? resolve(output) : null,
  dryRun: args.includes('--dry-run') || !output,
  status: result.issues.length ? 'rejected' : 'candidate',
  format: 'editor-v2/spatial-components-v1',
  changes: result.changes, issues: result.issues, notes: result.notes,
  runtimeStatus: 'Candidate definitions only; production runtime cutover is not yet implemented.',
};
if (report) writeFileSync(report, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
if (result.document && output && !summary.dryRun) {
  writeFileSync(output, `${JSON.stringify(result.document, null, 2)}\n`, { flag: 'wx' });
}
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (result.issues.length) process.exitCode = 1;
