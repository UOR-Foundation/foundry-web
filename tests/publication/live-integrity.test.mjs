import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const script = resolve('scripts/verify-publication.mjs');

// Process doubles test orchestration and substitution refusal only. They never
// supply production observations, application acceptance or SDK oracle evidence.
function boundary(t, defect) {
  const root = mkdtempSync(join(tmpdir(), 'foundry-live-integrity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'model'));
  mkdirSync(join(root, 'bin'));
  const digest = byte => `sha256:${byte.repeat(64)}`;
  const files = ['app.css', 'app.js', 'foundry.js', 'foundry_bg.wasm', 'index.html', 'provenance.json']
    .map(path => ({ digest: digest('f'), path, size: 0 }));
  const tree = `sha256:${createHash('sha256').update(JSON.stringify(files)).digest('hex')}`;
  const selection = {
    schema: 'foundry/publication-selection/1', target: 'https://uor-foundation.github.io/foundry-web/',
    release: { reference: `ghcr.io/uor-foundation/uor-foundry@${digest('a')}`,
      model_digest: digest('b'), build_digest: digest('c'), tree_digest: tree, policy_digest: digest('e') },
  };
  writeFileSync(join(root, 'model/publication.json'), JSON.stringify(
    defect === 'unselected' ? { ...selection, release: null } : selection));
  writeFileSync(join(root, 'bin/prismpm'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
const defect = ${JSON.stringify(defect)};
const selection = ${JSON.stringify(selection)};
const selected = selection.release;
const command = args[1];
if (defect === command + '-failure') process.exit(7);
let result = {};
if (command === 'verify-release') result = {
  schema: 'prismpm/signature-closure-result/1', verified: defect !== 'unverified',
  release_signatures: 1, promotion_signatures: 2, deployment_evidence_signatures: 1,
  status: defect === 'candidate' ? 'candidate' : 'accepted',
  policy_digest: selected.policy_digest, release_digest: selected.reference.split('@')[1]
};
if (command === 'verify-browser-publication') {
  result = { schema: 'prismpm/browser-publication-integrity/1', scope: 'browser-byte-integrity-only',
    reference: selected.reference, release_digest: selected.reference.split('@')[1],
    model_digest: selected.model_digest, build_digest: selected.build_digest, tree_digest: selected.tree_digest,
    url: selection.target, requests: 7, redirects: 0,
    files: ${JSON.stringify(files)}
  };
  for (const key of ['reference', 'release_digest', 'model_digest', 'build_digest', 'tree_digest', 'url', 'schema', 'scope']) {
    if (defect === 'wrong-' + key) result[key] = 'substituted';
  }
  if (defect === 'redirect') result.redirects = 1;
  if (defect === 'missing-request') result.requests--;
  if (defect === 'missing-file') result.files.pop();
  if (defect === 'duplicate-file') result.files[5] = result.files[0];
  if (defect === 'unsafe-path') result.files[0].path = '../private';
  if (defect === 'wrong-digest') result.files[0].digest = 'not-a-digest';
  if (defect === 'wrong-size') result.files[0].size = -1;
  if (defect === 'oversized-file') result.files[0].size = 67108865;
  if (defect === 'extra-acceptance') result.accepted = true;
  if (defect === 'extra-file-property') result.files[0].verified = true;
  if (defect === 'changed-valid-digest') result.files[0].digest = 'sha256:' + '0'.repeat(64);
  if (defect === 'changed-valid-size') result.files[0].size++;
  if (defect === 'unsorted-files') result.files.reverse();
  if (defect === 'wrong-profile') result.files[0].path = 'app.mjs';
  if (defect === 'mismatched-stem') result.files[3].path = 'other_bg.wasm';
}
process.stdout.write(defect === 'invalid-json' ? 'not a receipt' : JSON.stringify(result));
`, { mode: 0o755 });
  const result = spawnSync(process.execPath, [script], {
    cwd: root, env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` }, encoding: 'utf8',
  });
  return { root, result, selection };
}

for (const defect of ['unselected', 'lock-failure', 'pull-failure', 'verify-release-failure',
  'verify-browser-publication-failure', 'invalid-json', 'unverified', 'candidate',
  'wrong-reference', 'wrong-release_digest', 'wrong-model_digest', 'wrong-build_digest', 'wrong-tree_digest',
  'wrong-url', 'wrong-schema', 'wrong-scope', 'redirect', 'missing-request', 'missing-file', 'duplicate-file',
  'unsafe-path', 'wrong-digest', 'wrong-size', 'oversized-file', 'extra-acceptance', 'extra-file-property',
  'changed-valid-digest', 'changed-valid-size', 'unsorted-files', 'wrong-profile', 'mismatched-stem']) {
  test(`live integrity wrapper refuses ${defect} without recording success`, t => {
    const { root, result } = boundary(t, defect);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /publication integrity validation error:/);
    assert.equal(existsSync(join(root, 'reports/publication/integrity.json')), false);
  });
}

test('live integrity wrapper delegates exact immutable observation, never copies caller observations', t => {
  const { root, result, selection } = boundary(t, 'none');
  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls, [
    ['--json', 'lock', 'check'], ['--json', 'pull', selection.release.reference],
    ['--json', 'verify-release', selection.release.reference],
    ['--json', 'verify-browser-publication', selection.release.reference, '--url', selection.target],
  ]);
  const receipt = JSON.parse(readFileSync(join(root, 'reports/publication/integrity.json')));
  assert.equal(receipt.scope, 'browser-byte-integrity-only');
  assert.equal('accepted' in receipt, false);
  assert.equal(existsSync(join(root, 'site')), false);
});
