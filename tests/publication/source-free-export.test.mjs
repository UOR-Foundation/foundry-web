import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const script = resolve('scripts/export_browser.sh');
function isolated(t, selection) {
  const root = mkdtempSync(join(tmpdir(), 'foundry-export-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'model'));
  if (selection !== undefined) writeFileSync(join(root, 'model/publication.json'), JSON.stringify(selection));
  return root;
}
function run(root, output = 'site', env = {}) {
  return spawnSync('bash', [script, output], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
}
const selection = { schema: 'foundry/publication-selection/1', target: 'https://uor-foundation.github.io/foundry-web/', release: null };

test('actual exporter refuses an absent producer selection without making artifacts', t => {
  const root = isolated(t);
  const result = run(root);
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(existsSync(join(root, 'site')), false);
});
test('actual exporter refuses an explicitly unaccepted release', t => {
  const root = isolated(t, selection);
  const result = run(root);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /accepted immutable producer release/);
  assert.equal(existsSync(join(root, 'site')), false);
});
test('actual exporter never treats existing site files as an accepted producer', t => {
  const root = isolated(t, selection);
  mkdirSync(join(root, 'site'));
  writeFileSync(join(root, 'site/index.html'), 'preserve existing bytes');
  const result = run(root);
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(readFileSync(join(root, 'site/index.html'), 'utf8'), 'preserve existing bytes');
  assert.equal(existsSync(join(root, 'site/foundry_bg.wasm')), false);
});
test('source-free export requires the reviewed repository and digest, not a tag', t => {
  for (const reference of ['ghcr.io/uor-foundation/uor-foundry:latest', 'example.invalid/other@sha256:' + 'a'.repeat(64)]) {
    const root = isolated(t, { ...selection, release: { reference } });
    assert.notEqual(run(root).status, 0);
    assert.equal(existsSync(join(root, 'site')), false);
  }
});

// A process double tests the wrapper's refusal logic, NOT SDK verification,
// provenance, modeled application behavior, or release acceptance.
function sdkBoundary(t, defect) {
  const bytes = Buffer.from('fixture bytes, not a Foundry application');
  const fileDigest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const files = ['app.css', 'app.js', 'foundry.js', 'foundry_bg.wasm', 'index.html', 'provenance.json']
    .map(path => ({ digest: fileDigest, path, size: bytes.length }));
  const treeDigest = `sha256:${createHash('sha256').update(JSON.stringify(files)).digest('hex')}`;
  const release = {
    reference: `ghcr.io/uor-foundation/uor-foundry@sha256:${'a'.repeat(64)}`,
    model_digest: `sha256:${'b'.repeat(64)}`, build_digest: `sha256:${'c'.repeat(64)}`,
    tree_digest: treeDigest,
    policy_digest: `sha256:${'e'.repeat(64)}`,
  };
  const root = isolated(t, { ...selection, release });
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'prismpm'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
const defect = ${JSON.stringify(defect)};
const selected = ${JSON.stringify(release)};
const command = args[1];
if (defect === command + '-failure') process.exit(7);
let result = {};
if (command === 'verify-release') result = {
  schema: 'prismpm/signature-closure-result/1', verified: defect !== 'unverified',
  release_signatures: 1, promotion_signatures: 2, deployment_evidence_signatures: 1,
  status: defect === 'candidate' ? 'candidate' : 'accepted',
  policy_digest: defect === 'wrong-policy' ? 'sha256:' + '0'.repeat(64) : selected.policy_digest,
  release_digest: defect === 'wrong-release' ? 'sha256:' + '0'.repeat(64) : selected.reference.split('@')[1]
};
if (command === 'export-browser') {
  const output = args[4];
  fs.mkdirSync(output);
  for (const file of ${JSON.stringify(files)}) fs.writeFileSync(output + '/' + file.path, ${JSON.stringify(bytes.toString())});
  if (defect === 'extra-file') fs.writeFileSync(output + '/extra.js', 'unexpected');
  if (defect === 'missing-file') fs.unlinkSync(output + '/index.html');
  if (defect === 'symlink') { fs.unlinkSync(output + '/index.html'); fs.symlinkSync('../calls.jsonl', output + '/index.html'); }
  if (defect === 'hardlink') fs.linkSync(output + '/index.html', 'second-link');
  if (defect === 'root-symlink') { fs.renameSync(output, 'substituted-root'); fs.symlinkSync('substituted-root', output, 'dir'); }
  result = {
    schema: 'prismpm/browser-export/1', reference: selected.reference,
    release_digest: selected.reference.split('@')[1], output,
    model_digest: selected.model_digest, build_digest: selected.build_digest, tree_digest: selected.tree_digest,
    files: ${JSON.stringify(files)}
  };
  if (defect === 'wrong-model') result.model_digest = 'sha256:' + '0'.repeat(64);
  if (defect === 'wrong-build') result.build_digest = 'sha256:' + '0'.repeat(64);
  if (defect === 'wrong-tree') result.tree_digest = 'sha256:' + '0'.repeat(64);
  if (defect === 'wrong-size') result.files[0].size++;
  if (defect === 'wrong-digest') result.files[0].digest = 'sha256:' + '0'.repeat(64);
  if (defect === 'duplicate-file') result.files.push(result.files[0]);
  if (defect === 'traversal') result.files[0].path = '../calls.jsonl';
  if (defect === 'extra-acceptance') result.accepted = true;
  if (defect === 'extra-file-property') result.files[0].verified = true;
}
process.stdout.write(defect === 'invalid-json' ? 'not a receipt' : JSON.stringify(result));
`, { mode: 0o755 });
  return { root, env: { PATH: `${bin}:${process.env.PATH}` } };
}
for (const defect of ['lock-failure', 'pull-failure', 'verify-release-failure', 'export-browser-failure',
  'invalid-json', 'unverified', 'candidate', 'wrong-policy', 'wrong-release', 'wrong-model', 'wrong-build', 'wrong-tree',
  'extra-file', 'missing-file', 'symlink', 'root-symlink', 'hardlink', 'wrong-size', 'wrong-digest', 'duplicate-file', 'traversal',
  'extra-acceptance', 'extra-file-property']) {
  test(`actual exporter rejects ${defect} at its SDK process boundary`, t => {
    const { root, env } = sdkBoundary(t, defect);
    const result = run(root, 'site', env);
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(existsSync(join(root, 'reports/publication/export.json')), false);
    if (['lock-failure', 'pull-failure', 'verify-release-failure', 'invalid-json', 'unverified', 'candidate', 'wrong-policy', 'wrong-release'].includes(defect)) {
      assert.equal(existsSync(join(root, 'site')), false);
      assert.doesNotMatch(readFileSync(join(root, 'calls.jsonl'), 'utf8'), /export-browser/);
    }
  });
}
test('wrapper preserves byte-identical process output and invokes SDK checks in order (not product acceptance)', t => {
  const { root, env } = sdkBoundary(t, 'none');
  const result = run(root, 'site', env);
  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map(args => args[1]), ['lock', 'pull', 'verify-release', 'export-browser']);
  assert.equal(readFileSync(join(root, 'site/index.html'), 'utf8'), 'fixture bytes, not a Foundry application');
  assert.equal(JSON.parse(readFileSync(join(root, 'reports/publication/export.json'))).schema, 'prismpm/browser-export/1');
});
test('actual exporter safely cleans and overwrites existing destination directory for verified producer', t => {
  const { root, env } = sdkBoundary(t, 'none');
  mkdirSync(join(root, 'site'));
  writeFileSync(join(root, 'site/preexisting.txt'), 'stale artifact');
  const result = run(root, 'site', env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(root, 'site/preexisting.txt')), false);
  assert.equal(readFileSync(join(root, 'site/index.html'), 'utf8'), 'fixture bytes, not a Foundry application');
});
