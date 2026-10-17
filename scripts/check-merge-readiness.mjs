import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assessMerge } from '../tools/delivery/merge-readiness.mjs';

try {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/check-merge-readiness.mjs <snapshot.json>');
  const path = process.argv[2];
  if (!statSync(path).isFile() || statSync(path).size > 4 * 1024 * 1024) throw new Error('Snapshot must be a file of at most 4 MiB');
  const snapshot = JSON.parse(readFileSync(path, 'utf8'));
  const policy = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/delivery/merge-policy.json', import.meta.url)), 'utf8'));
  const result = assessMerge(snapshot, policy);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.eligible ? 0 : 1;
} catch (error) {
  process.stderr.write('Merge evidence rejected: ' + (error instanceof SyntaxError ? 'invalid JSON' : error.message) + '\n');
  process.exitCode = 2;
}
