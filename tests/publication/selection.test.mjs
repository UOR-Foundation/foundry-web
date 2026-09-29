import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const moduleUrl = pathToFileURL(resolve('scripts/publication-sdk.mjs')).href;
const selection = {
  schema: 'foundry/publication-selection/1',
  target: 'https://uor-foundation.github.io/foundry-web/',
  release: {
    reference: `ghcr.io/uor-foundation/uor-foundry@sha256:${'a'.repeat(64)}`,
    policy_digest: `sha256:${'b'.repeat(64)}`, model_digest: `sha256:${'c'.repeat(64)}`,
    build_digest: `sha256:${'d'.repeat(64)}`, tree_digest: `sha256:${'e'.repeat(64)}`,
  },
};

function run(t, value) {
  const root = mkdtempSync(join(tmpdir(), 'foundry-selection-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'model'));
  writeFileSync(join(root, 'model/publication.json'), JSON.stringify(value));
  return spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { selectedProducer } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(selectedProducer()));`],
  { cwd: root, encoding: 'utf8' });
}

// These are input-contract regressions, not a producer or publication receipt.
for (const [name, mutate] of [
  ['extra selection authority', s => { s.accepted = true; }],
  ['alternate target', s => { s.deployment_target = 'https://example.invalid/'; }],
  ['extra release authority', s => { s.release.accepted = true; }],
  ['extra release revision', s => { s.release.producer_commit = 'f'.repeat(40); }],
  ['missing digest', s => { delete s.release.policy_digest; }],
  ['wrong digest type', s => { s.release.tree_digest = ['sha256:' + 'e'.repeat(64)]; }],
  ['wrong reference type', s => { s.release.reference = [s.release.reference]; }],
  ['wrong target', s => { s.target += '?unreviewed'; }],
  ['missing schema', s => { delete s.schema; }],
]) {
  test(`selection refuses ${name}`, t => {
    const value = structuredClone(selection);
    mutate(value);
    assert.notEqual(run(t, value).status, 0);
  });
}
for (const value of [null, [], false, 'accepted', { ...selection, release: null }]) {
  test(`selection refuses non-selection or unselected input ${JSON.stringify(value)}`, t => {
    assert.notEqual(run(t, value).status, 0);
  });
}
test('selection preserves exactly the reviewed contract without asserting acceptance', t => {
  const result = run(t, selection);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), selection);
});
