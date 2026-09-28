import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';

const script = resolve('scripts/verify-publication.mjs');

async function serve(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('LA-01 live asset capture bounds a real chunked response before EOF', { timeout: 30_000 }, async t => {
  const { captureLiveAsset } = await import('../../scripts/live-assets.mjs');
  let closed;
  const disconnected = new Promise(resolve => { closed = resolve; });
  const server = createServer((_request, response) => {
    response.on('close', closed);
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.write(Buffer.from([1, 2, 3, 4]));
    // Deliberately never finish: the receiver must cancel at byte four.
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await assert.rejects(captureLiveAsset(`http://127.0.0.1:${server.address().port}/asset`,
    { expectedSize: 3 }), { code: 'ASSET_BOUND' });
  await disconnected;
});

test('LA-01 captures exact EOF bytes and SHA across empty, tiny and segmented responses', { timeout: 30_000 }, async t => {
  const { captureLiveAsset } = await import('../../scripts/live-assets.mjs');
  const payload = Buffer.alloc(2_097_157);
  for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
  const base = await serve(t, async (request, response) => {
    response.setHeader('content-type', 'application/octet-stream');
    if (request.url === '/empty') return response.end();
    for (let at = 0; at < payload.length; at += 7919) {
      if (!response.write(payload.subarray(at, at + 7919))) await once(response, 'drain');
    }
    response.end();
  });
  const empty = await captureLiveAsset(base + '/empty', { expectedSize: 0 });
  assert.equal(empty.size, 0); assert.equal(empty.bytes.length, 0);
  assert.equal(empty.digest, `sha256:${createHash('sha256').digest('hex')}`);
  for (const options of [{ expectedSize: payload.length }, {}]) {
    const result = await captureLiveAsset(base + '/body', options);
    assert.deepEqual(result.bytes, payload); assert.equal(result.size, payload.length);
    assert.equal(result.digest, `sha256:${createHash('sha256').update(payload).digest('hex')}`);
    assert.equal(result.status, 200); assert.equal(result.contentType, 'application/octet-stream');
  }
});

test('LA-01 preserves the full 64 MiB asset domain and refuses actual one-over bytes', { timeout: 30_000 }, async t => {
  const { captureLiveAsset, maximumLiveAssetBytes } = await import('../../scripts/live-assets.mjs');
  assert.equal(maximumLiveAssetBytes, 67_108_864);
  const chunk = Buffer.alloc(1_048_576, 137), hash = createHash('sha256');
  for (let i = 0; i < 64; i++) hash.update(chunk);
  const expected = `sha256:${hash.digest('hex')}`;
  const base = await serve(t, async (request, response) => {
    for (let i = 0; i < 64; i++) {
      if (!response.write(chunk)) await once(response, 'drain');
    }
    response.end(request.url === '/overflow' ? Buffer.from([137]) : undefined);
  });
  const result = await captureLiveAsset(base + '/maximum');
  assert.equal(result.bytes.length, maximumLiveAssetBytes); assert.equal(result.digest, expected);
  assert.ok(result.bytes.every(byte => byte === 137));
  await assert.rejects(captureLiveAsset(base + '/overflow'), { code: 'ASSET_BOUND' });
});

test('LA-01 rejects early EOF, truncated HTTP framing and compressed expansion', { timeout: 30_000 }, async t => {
  const { captureLiveAsset } = await import('../../scripts/live-assets.mjs');
  const compressed = gzipSync(Buffer.alloc(4096, 7));
  const base = await serve(t, (request, response) => {
    if (request.url === '/truncated') {
      response.writeHead(200, { 'content-length': '99' }); response.write('short');
      return setImmediate(() => response.socket.destroy());
    }
    if (request.url === '/compressed') {
      response.writeHead(200, { 'content-encoding': 'gzip', 'content-length': compressed.length });
      return response.end(compressed);
    }
    response.end('short');
  });
  await assert.rejects(captureLiveAsset(base + '/short', { expectedSize: 6 }), { code: 'ASSET_LENGTH' });
  await assert.rejects(captureLiveAsset(base + '/truncated'), TypeError);
  await assert.rejects(captureLiveAsset(base + '/compressed', { expectedSize: 128 }), { code: 'ASSET_BOUND' });
  const valid = await captureLiveAsset(base + '/compressed', { expectedSize: 4096 });
  assert.deepEqual(valid.bytes, Buffer.alloc(4096, 7));
  assert.equal(valid.digest, `sha256:${createHash('sha256').update(valid.bytes).digest('hex')}`);
});

test('LA-01 refuses redirects without following them and cancels a stalled body', { timeout: 30_000 }, async t => {
  const { captureLiveAsset } = await import('../../scripts/live-assets.mjs');
  let followed = 0, disconnected;
  const closed = new Promise(resolve => { disconnected = resolve; });
  const base = await serve(t, (request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { location: '/destination' }); return response.end('redirect');
    }
    if (request.url === '/destination') { followed++; return response.end(); }
    response.on('close', disconnected);
    response.writeHead(200); response.write('partial');
  });
  await assert.rejects(captureLiveAsset(base + '/redirect'), TypeError);
  assert.equal(followed, 0);
  await assert.rejects(captureLiveAsset(base + '/stall', { timeoutMilliseconds: 100 }), { code: 'ASSET_TIMEOUT' });
  await closed;
});

test('LA-01 rejects invalid observation bounds before making an HTTP request', { timeout: 30_000 }, async t => {
  const { captureLiveAsset } = await import('../../scripts/live-assets.mjs');
  let calls = 0;
  const base = await serve(t, (_request, response) => { calls++; response.end(); });
  for (const expectedSize of [-1, 0.5, NaN, Infinity, '3', 67_108_865])
    await assert.rejects(captureLiveAsset(base, { expectedSize }), { code: 'ASSET_POLICY' });
  for (const timeoutMilliseconds of [0, 0.5, 30_001, NaN, Infinity, '3'])
    await assert.rejects(captureLiveAsset(base, { timeoutMilliseconds }), { code: 'ASSET_POLICY' });
  assert.equal(calls, 0);
});

test('LA-01 actual audit uses the bounded selected-size capture without whole-body buffering', () => {
  const source = readFileSync('tests/e2e/audit-deployed.mjs', 'utf8');
  const verify = text => {
    assert.match(text, /import \{ captureLiveAsset \} from '\.\.\/\.\.\/scripts\/live-assets\.mjs';/);
    assert.equal((text.match(/await captureLiveAsset\(/g) ?? []).length, 1);
    assert.match(text, /captureLiveAsset\(new URL\(path, target\),\s*\{ expectedSize: expected\?\.size \?\? null \}\)/);
    assert.doesNotMatch(text, /\.arrayBuffer\(/);
  };
  verify(source);
  assert.throws(() => verify(source.replace('expectedSize: expected?.size ?? null', 'expectedSize: null')));
  assert.throws(() => verify(source.replace('await captureLiveAsset(', 'await uncheckedAsset(')));
  assert.throws(() => verify(source + '\nresponse.arrayBuffer();\n'));
});

test('LA-01 real HTTP gates detect changed bound, missing EOF check and discarded hash updates', { timeout: 30_000 }, async t => {
  const original = readFileSync('scripts/live-assets.mjs', 'utf8');
  const { captureLiveAsset } = await import('../../scripts/live-assets.mjs');
  const payload = Buffer.from([1, 2, 3, 4]);
  const base = await serve(t, (_request, response) => response.end(payload));
  const mutations = [
    { before: 'const maximum = expectedSize ?? maximumLiveAssetBytes;',
      after: 'const maximum = maximumLiveAssetBytes;',
      gate: capture => assert.rejects(capture(base, { expectedSize: 3 }), { code: 'ASSET_BOUND' }) },
    { before: 'if (expectedSize !== null && size !== expectedSize)',
      after: 'if (false)',
      gate: capture => assert.rejects(capture(base, { expectedSize: 5 }), { code: 'ASSET_LENGTH' }) },
    { before: 'hash.update(value);', after: 'void value;',
      gate: async capture => assert.equal((await capture(base)).digest,
        `sha256:${createHash('sha256').update(payload).digest('hex')}`) },
  ];
  for (const { before, after, gate } of mutations) {
    assert.equal(original.split(before).length, 2, 'one exact actual source mutation');
    await gate(captureLiveAsset);
    const changed = original.replace(before, after);
    const mutant = await import(`data:text/javascript;base64,${Buffer.from(changed).toString('base64')}`);
    await assert.rejects(gate(mutant.captureLiveAsset), { code: 'ERR_ASSERTION' },
      'the actual imported defect must fail its real HTTP gate');
  }
});

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
