import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/observe-pages.mjs');
const policyBytes = readFileSync('model/pages_state.toml');
const repository = 'UOR-Foundation/foundry-web';
const target = 'https://uor-foundation.github.io/foundry-web/';

function boundary(t, defect, phase = 'initial') {
  const root = mkdtempSync(join(tmpdir(), 'foundry-pages-observer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'model'));
  writeFileSync(join(root, 'model/pages_state.toml'), policyBytes);
  const release = { reference: `ghcr.io/uor-foundation/uor-foundry@sha256:${'a'.repeat(64)}`,
    policy_digest: `sha256:${'b'.repeat(64)}`, model_digest: `sha256:${'c'.repeat(64)}`,
    build_digest: `sha256:${'d'.repeat(64)}`, tree_digest: `sha256:${'e'.repeat(64)}` };
  writeFileSync(join(root, 'model/publication.json'), JSON.stringify({
    schema: 'foundry/publication-selection/1', target, release: defect === 'unselected' ? null : release,
  }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '--quiet');
  git('add', 'model');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'test: isolated publisher fixture');
  const revision = git('rev-parse', 'HEAD');
  if (phase === 'final') {
    mkdirSync(join(root, 'reports/publication'), { recursive: true });
    writeFileSync(join(root, 'reports/publication/pages-observation.json'), 'initial diagnostic fixture');
  }
  if (defect === 'dirty-checkout') writeFileSync(join(root, 'model/pages_state.toml'), `${policyBytes}\n# changed\n`);

  // Process-only doubles. Every call is captured; no fixture is deployment,
  // producer, transport or acceptance evidence and no request reaches a server.
  const preload = join(root, 'transport-fixture.mjs');
  writeFileSync(preload, `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
const defect = ${JSON.stringify(defect)};
const revision = ${JSON.stringify(revision)};
const target = ${JSON.stringify(target)};
const repository = ${JSON.stringify(repository)};
const api = 'https://api.github.com/repos/' + repository;
const record = call => fs.appendFileSync('calls.jsonl', JSON.stringify(call) + '\\n');
let mainReads = 0;
globalThis.fetch = async (url, options) => {
  record({kind:'api', url});
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, 'Bearer fixture-token');
  assert.equal(options.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.ok(options.signal instanceof AbortSignal);
  let result;
  if (url === api + '/git/ref/heads/main') {
    mainReads++;
    if (defect === 'final-api-failure' && mainReads === 2) return new Response('{}', {status:503});
    result = {object:{sha:defect === 'superseded' || (defect === 'superseded-during-capture' && mainReads === 2) ? 'f'.repeat(40) : revision}};
  }
  else if (url === api + '/pages') {
    if (defect === 'api-failure') return new Response('{}', {status:403});
    if (defect === 'api-invalid-json') return new Response('broken', {status:200});
    if (defect === 'api-overflow') return new Response('x'.repeat(1048577), {status:200});
    result = {html_url:target,build_type:'workflow',https_enforced:defect !== 'https-disabled',cname:null,source:{branch:'main',path:'/'}};
  } else if (url === api + '/actions/runs/123') result = {id:123,run_attempt:2,path:'.github/workflows/pages.yml',head_sha:revision,
    head_branch:'main',event:'workflow_run',status:'in_progress',conclusion:null,run_started_at:'2026-09-27T00:00:00Z',
    repository:{full_name:repository},head_repository:{full_name:repository}};
  else if (url === api + '/actions/jobs/789') {
    if (defect === 'job-not-found') return new Response('{}', {status:404});
    result = {id:789,run_id:123,run_attempt:defect === 'old-job-attempt' ? 1 : 2,head_sha:revision,head_branch:'main',
      name:defect === 'wrong-job' ? 'other' : 'publish / github-pages',status:'completed',conclusion:'success',
      html_url:'https://github.com/'+repository+'/actions/runs/123/job/789'};
  }
  else if (url === api + '/deployments?environment=github-pages&per_page=1') result = defect === 'no-deployment' ? [] :
    [{id:456,sha:revision,ref:'main',environment:'github-pages',repository_url:api,
      performed_via_github_app:{slug:'github-actions'},created_at:'2026-09-27T00:01:00Z'}];
  else if (url === api + '/deployments/456/statuses?per_page=1') result =
    [{id:111,state:defect === 'inactive' ? 'inactive' : 'success',environment:'github-pages',environment_url:target,
      deployment_url:api+'/deployments/456',log_url:'https://github.com/'+repository+'/actions/runs/123/job/789',created_at:'2026-09-27T00:02:00Z'}];
  else throw Error('unregistered API request');
  return new Response(JSON.stringify(result), {status:200});
};
function transport(secure) { return (url, options, callback) => {
  record({kind:'transport',url:String(url),secure});
  assert.equal(String(url), secure ? target : target.replace('https:', 'http:'));
  assert.equal(options.method, 'HEAD');
  assert.equal(options.agent, false);
  assert.equal(options.headers, undefined);
  assert.ok(options.signal instanceof AbortSignal);
  if (secure) { assert.equal(options.minVersion, 'TLSv1.3'); assert.equal(options.maxVersion, 'TLSv1.3'); assert.equal(options.rejectUnauthorized, true); }
  const request = new EventEmitter();
  request.end = () => queueMicrotask(() => {
    if (secure && defect === 'tls-failure') return request.emit('error', Error('fixture TLS failure'));
    callback({statusCode:secure ? 200 : defect === 'http-plaintext' ? 200 : 301,
      headers:{location:secure ? undefined : target},socket:{getProtocol:()=> 'TLSv1.3',authorized:true},destroy(){}});
  });
  return request;
}; }
http.request = transport(false);
https.request = transport(true);
syncBuiltinESMExports();
`);
  const result = spawnSync(process.execPath, ['--import', preload, script,
    ...(defect === 'caller-observations' ? ['caller-receipt.json'] : [])], {
    cwd: root, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, GH_TOKEN: 'fixture-token', GITHUB_REPOSITORY: repository,
      PAGES_OBSERVATION_PHASE: defect === 'invalid-phase' ? 'other' : phase,
      GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2',
      PUBLISH_SHA: defect === 'wrong-checkout' ? 'f'.repeat(40) : revision,
      PAGES_DEPLOYED_URL: defect === 'wrong-action-url' ? 'https://example.invalid/' : target },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return { result, root, release, revision,
    report: JSON.parse(readFileSync(join(root, phase === 'final'
      ? 'reports/publication/pages-observation-final.json' : 'reports/publication/pages-observation.json'))) };
}

for (const defect of ['unselected', 'dirty-checkout', 'wrong-checkout', 'wrong-action-url', 'superseded',
  'api-failure', 'api-invalid-json', 'api-overflow', 'https-disabled', 'no-deployment', 'inactive', 'tls-failure', 'http-plaintext',
  'job-not-found', 'old-job-attempt', 'wrong-job', 'superseded-during-capture', 'final-api-failure',
  'invalid-phase', 'caller-observations']) {
  test(`actual Pages observer refuses ${defect} and records no successful observation`, t => {
    const { result, report } = boundary(t, defect);
    assert.notEqual(result.status, 0);
    assert.equal(report.verified, false);
    assert.equal(report.acceptance, 'not-established');
    assert.doesNotMatch(JSON.stringify(report), /fixture-token/);
    assert.match(result.stderr, /Pages observation validation error:/);
    if (['api-failure', 'api-invalid-json', 'api-overflow', 'tls-failure'].includes(defect)) {
      assert.equal(report.snapshot.main.object.sha, report.context.revision);
      assert.equal(report.snapshot.statuses[0].state, 'success');
    }
  });
}
test('actual observer captures all fixed endpoints and transport, retaining exact context without acceptance', t => {
  const { root, result, report, release, revision } = boundary(t, 'none');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.verified, true);
  assert.equal(report.acceptance, 'not-established');
  assert.equal(report.scope, 'pages-metadata-and-transport-only');
  assert.deepEqual(report.context, { repository, target, revision, run_id: 123, run_attempt: 2 });
  assert.deepEqual(report.release, release);
  const calls = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const api = `https://api.github.com/repos/${repository}`;
  assert.deepEqual(calls.filter(call => call.kind === 'api').map(call => call.url).sort(), [
    '/git/ref/heads/main', '/pages', '/actions/runs/123', '/actions/jobs/789',
    '/deployments?environment=github-pages&per_page=1', '/deployments/456/statuses?per_page=1',
    '/git/ref/heads/main', '/actions/runs/123',
    '/deployments?environment=github-pages&per_page=1', '/deployments/456/statuses?per_page=1',
  ].map(path => api + path).sort());
  assert.deepEqual(calls.filter(call => call.kind === 'transport').map(call => call.url).sort(),
    [target, target.replace('https:', 'http:')].sort());
});
test('final observer executes fresh capture and preserves the initial observation separately', t => {
  const { root, result, report } = boundary(t, 'none', 'final');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.phase, 'final');
  assert.equal(report.verified, true);
  assert.equal(report.acceptance, 'not-established');
  assert.equal(readFileSync(join(root, 'reports/publication/pages-observation.json'), 'utf8'), 'initial diagnostic fixture');
  const calls = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.filter(call => call.kind === 'api').length, 10);
  assert.equal(calls.filter(call => call.kind === 'transport').length, 2);
});
