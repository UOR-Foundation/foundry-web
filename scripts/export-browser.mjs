// Publication infrastructure only. Never generates or patches application bytes.
import { readFileSync, lstatSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const digest = value => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
function sdk(...args) {
  const result = spawnSync('prismpm', ['--json', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20 * 60 * 1000 });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`locked SDK ${args[0]} failed: ${result.error?.message ?? result.stderr ?? result.signal}`);
  }
  return JSON.parse(result.stdout);
}
function regular(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Not a singly-linked regular file: ${path}`);
  return readFileSync(path);
}
function walk(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walk(root, path);
    if (!entry.isFile()) throw new Error(`Export contains a non-regular file: ${path}`);
    return [path];
  }).sort();
}
try {
  const output = process.argv[2];
  if (process.argv.length !== 3 || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(output ?? '')) {
    throw new Error('Output must be one new portable directory name');
  }
  const selection = JSON.parse(regular('model/publication.json'));
  if (selection.schema !== 'foundry/publication-selection/1'
    || selection.target !== 'https://uor-foundation.github.io/foundry-web/') throw new Error('Unreviewed publication target or schema');
  const release = selection.release;
  if (!release) throw new Error('No accepted immutable producer release is selected; application publication is refused');
  if (!/^ghcr\.io\/uor-foundation\/uor-foundry@sha256:[0-9a-f]{64}$/.test(release.reference ?? '')
    || !['policy_digest', 'model_digest', 'build_digest', 'tree_digest'].every(key => digest(release[key]))) {
    throw new Error('Producer selection must bind the reviewed repository and exact release, signing policy, model, build, and browser-tree digests');
  }
  try { lstatSync(output); throw new Error('Export destination already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }

  sdk('lock', 'check');
  sdk('pull', release.reference);
  const trust = sdk('verify-release', release.reference);
  if (trust.schema !== 'prismpm/signature-closure-result/1' || trust.verified !== true
    || trust.status !== 'accepted' || trust.release_digest !== release.reference.split('@')[1]
    || trust.policy_digest !== release.policy_digest) {
    throw new Error('Release signature closure is not accepted for the selected producer');
  }
  const receipt = sdk('export-browser', release.reference, '--output', output);
  if (receipt.schema !== 'prismpm/browser-export/1' || receipt.reference !== release.reference
    || receipt.release_digest !== trust.release_digest || receipt.output !== output
    || !['model_digest', 'build_digest', 'tree_digest'].every(key => receipt[key] === release[key])
    || !Array.isArray(receipt.files) || !receipt.files.length) throw new Error('Export is not bound to the selected release');
  if (!lstatSync(output).isDirectory()) throw new Error('Export root is not an ordinary directory');
  const actual = walk(output);
  if (new Set(receipt.files.map(file => file.path)).size !== receipt.files.length
    || JSON.stringify(actual) !== JSON.stringify(receipt.files.map(file => file.path).sort())) {
    throw new Error('Exported file inventory is incomplete or contains extra files');
  }
  for (const file of receipt.files) {
    if (!/^[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9_-]+)*$/.test(file.path)
      || file.path.startsWith('/') || file.path.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Unsafe artifact path');
    }
    const bytes = regular(join(output, file.path));
    if (bytes.length !== file.size || sha(bytes) !== file.digest) throw new Error(`Export bytes changed: ${file.path}`);
  }
  // Stored outside the published directory; never add files to the SDK closure.
  mkdirSync('reports/publication', { recursive: true });
  writeFileSync('reports/publication/export.json', `${JSON.stringify(receipt)}\n`);
  console.log(JSON.stringify(receipt));
} catch (error) {
  console.error(`publication pipeline validation error: ${error.message}`);
  process.exitCode = 1;
}
