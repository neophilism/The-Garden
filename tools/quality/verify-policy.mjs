import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { assertWorkflow, assertLock, assertManifests, credentialFindings } from './policy.mjs';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = p => readFileSync(join(root, p), 'utf8');
for (const name of readdirSync(join(root, '.github/workflows'))) {
  if (!/\.ya?ml$/.test(name)) throw Error('Unexpected workflow file');
  const doc = parseDocument(read('.github/workflows/' + name), { uniqueKeys: true, maxAliasCount: 0 });
  if (doc.errors.length) throw Error('Invalid workflow YAML: ' + name);
  assertWorkflow(doc.toJS({ maxAliasCount: 0 }));
}
for (const p of ['package-lock.json', 'tools/quality/package-lock.json']) assertLock(JSON.parse(read(p)));
for (const p of ['package.json', 'apps/public/package.json', 'apps/research/package.json', 'packages/domain/package.json', 'services/workers/package.json', 'tools/quality/package.json']) assertManifests(JSON.parse(read(p)));
function scan(dir) {
  for (const name of readdirSync(join(root, dir))) {
    if (['node_modules', '.next', 'out', 'test-results', 'playwright-report'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) scan(p);
    else if (/\.(?:[cm]?js|tsx?|json|ya?ml|css|html)$/.test(name)) {
      const hits = credentialFindings(read(p));
      if (hits.length) throw Error('Credential-shaped value in ' + p + ': ' + hits.join(', '));
    }
  }
}
for (const dir of ['apps', 'packages', 'services', '.github', 'config']) scan(dir);
if(credentialFindings(read('scripts/check-environment.mjs')).length)throw Error('Credential-shaped value in configuration CLI');
console.log('CI permissions, immutable action pins, dependency locks and bounded credential checks passed. Not runtime security certification.');
