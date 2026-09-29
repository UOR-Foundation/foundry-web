// PS-01: GitHub-specific publication observations, not application acceptance.
import { spawnSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { regular } from './publication-sdk.mjs';

const repository = 'UOR-Foundation/foundry-web';
const apiRoot = `https://api.github.com/repos/${repository}`;
const positive = n => Number.isSafeInteger(n) && n > 0;
const fail = message => { throw new Error(`PS-01: ${message}`); };
const closed = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.slice().sort());

export function readPagesPolicy() {
  // Use the immutable SDK's standard TOML parser, not a second policy source or
  // a permissive handwritten parser. No product source is compiled here.
  const parsed = spawnSync('python3', ['-I', '-c',
    'import json,sys,tomllib; print(json.dumps(tomllib.loads(sys.stdin.read())))'], {
    input: regular('model/pages_state.toml'), encoding: 'utf8', timeout: 10000, maxBuffer: 1048576,
  });
  if (parsed.error || parsed.signal || parsed.status !== 0) fail('desired Pages policy cannot be parsed');
  const policy = JSON.parse(parsed.stdout);
  if (!closed(policy, ['spec', 'stage', 'policy', 'deployment_target', 'https_enforcement', 'artifact_verification'])
    || policy.spec !== 'foundry/pages-state/1' || policy.stage !== 'staged-core'
    || !closed(policy.policy, ['require_active_deployment', 'require_https_enforcement',
      'require_pages_artifact_verification', 'prohibit_unverified_pages_origin', 'prohibit_stale_deployments'])
    || Object.values(policy.policy).some(value => value !== true)
    || !closed(policy.deployment_target, ['origin', 'subpath', 'url', 'environment', 'branch', 'build_type', 'min_deployment_count'])
    || policy.deployment_target.origin !== 'https://uor-foundation.github.io'
    || policy.deployment_target.subpath !== '/foundry-web/'
    || policy.deployment_target.url !== policy.deployment_target.origin + policy.deployment_target.subpath
    || policy.deployment_target.environment !== 'github-pages' || policy.deployment_target.branch !== 'main'
    || policy.deployment_target.build_type !== 'workflow' || policy.deployment_target.min_deployment_count !== 1
    || !closed(policy.https_enforcement, ['enforced', 'tls_version'])
    || policy.https_enforcement.enforced !== true || policy.https_enforcement.tls_version !== 'TLSv1.3'
    || !closed(policy.artifact_verification, ['expected_artifact_name', 'expected_asset_count'])
    || policy.artifact_verification.expected_artifact_name !== 'github-pages'
    || policy.artifact_verification.expected_asset_count !== 6) fail('invalid or weakened desired Pages policy');
  return policy;
}

export function validateContext(context, policy) {
  if (!closed(context, ['repository', 'target', 'revision', 'run_id', 'run_attempt'])
    || context.repository !== repository || context.target !== policy.deployment_target.url
    || typeof context.revision !== 'string' || !/^[0-9a-f]{40}$/.test(context.revision)
    || !positive(context.run_id) || !positive(context.run_attempt)) fail('unbound workflow deployment context');
}

function validateObservation(snapshot, context, policy) {
  validateContext(context, policy);
  const { main, pages, run, deployments, statuses, job, transport } = snapshot;
  if (main?.object?.sha !== context.revision) fail('publisher revision is no longer current main');
  if (pages?.html_url !== context.target || pages.build_type !== policy.deployment_target.build_type
    || pages.https_enforced !== true || pages.cname !== null
    || pages.source?.branch !== policy.deployment_target.branch || pages.source?.path !== '/') {
    fail('Pages configuration does not enforce the approved HTTPS workflow target');
  }
  if (run?.id !== context.run_id || run.run_attempt !== context.run_attempt
    || run.path !== '.github/workflows/pages.yml' || run.head_sha !== context.revision
    || run.head_branch !== policy.deployment_target.branch || run.repository?.full_name !== repository
    || run.head_repository?.full_name !== repository || !['workflow_dispatch', 'workflow_run'].includes(run.event)
    || !((run.status === 'in_progress' && run.conclusion === null)
      || (run.status === 'completed' && run.conclusion === 'success'))) fail('workflow run identity/state differs');
  if (!Array.isArray(deployments) || deployments.length !== 1 || !positive(deployments[0]?.id)) {
    fail('latest Pages deployment is absent or ambiguous');
  }
  const deployment = deployments[0];
  if (deployment.sha !== context.revision || deployment.ref !== policy.deployment_target.branch
    || deployment.environment !== policy.deployment_target.environment
    || deployment.repository_url !== apiRoot || deployment.performed_via_github_app?.slug !== 'github-actions') {
    fail('latest Pages deployment does not bind the publisher revision and environment');
  }
  if (!Array.isArray(statuses) || statuses.length !== 1) fail('latest deployment status is absent or ambiguous');
  const status = statuses[0];
  const logPrefix = `https://github.com/${repository}/actions/runs/${context.run_id}`;
  if (!positive(status?.id) || status.state !== 'success' || status.environment !== policy.deployment_target.environment
    || status.environment_url !== context.target || status.deployment_url !== `${apiRoot}/deployments/${deployment.id}`
    || typeof status.log_url !== 'string' || !status.log_url.startsWith(`${logPrefix}/job/`)
    || !/^[1-9][0-9]*$/.test(status.log_url.slice(`${logPrefix}/job/`.length))) {
    fail('latest deployment status is not successful for this workflow and exact target');
  }
  const jobId = Number(status.log_url.slice(`${logPrefix}/job/`.length));
  if (!positive(jobId) || job?.id !== jobId || job.run_id !== context.run_id
    || job.run_attempt !== context.run_attempt || job.head_sha !== context.revision
    || job.head_branch !== policy.deployment_target.branch || job.name !== 'publish / github-pages'
    || job.status !== 'completed' || job.conclusion !== 'success' || job.html_url !== status.log_url) {
    fail('deployment log does not identify this attempt\'s successful publisher job');
  }
  const times = [run.run_started_at, deployment.created_at, status.created_at].map(value =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ? Date.parse(value) : NaN);
  if (times.some(time => !Number.isFinite(time)) || times[0] > times[1] || times[1] > times[2]) {
    fail('deployment/status predates this workflow attempt or has an invalid timestamp');
  }
  if (!transport || ![301, 302, 303, 307, 308].includes(transport.http_status)
    || transport.location !== context.target || transport.https_status !== 200
    || transport.tls_version !== policy.https_enforcement.tls_version || transport.authorized !== true) {
    fail('observed HTTP upgrade, HTTPS response or authenticated TLS violates policy');
  }
}

export function validatePagesSnapshot(snapshot, context, policy) {
  validateObservation(snapshot, context, policy);
  if (!closed(snapshot.final, ['main', 'run', 'deployments', 'statuses'])
    || snapshot.final.deployments?.[0]?.id !== snapshot.deployments[0].id
    || snapshot.final.statuses?.[0]?.id !== snapshot.statuses[0].id) {
    fail('final current-main/run/deployment/status observations are missing or changed');
  }
  validateObservation({ ...snapshot, ...snapshot.final }, context, policy);
}

export async function githubJson(path, token) {
  // API paths are assembled from fixed endpoints and validated numeric IDs.
  // No redirect, endpoint override or caller-supplied receipt is accepted.
  if (!/^\/(?:pages|git\/ref\/heads\/main|actions\/(?:runs|jobs)\/[1-9][0-9]*|deployments(?:\/[1-9][0-9]*\/statuses)?)(?:\?environment=github-pages&per_page=1|\?per_page=1)?$/.test(path)) {
    fail('invalid Pages observation endpoint');
  }
  const response = await fetch(apiRoot + path, {
    redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'foundry-web-publication-observer', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    fail(`GitHub observation ${path} returned HTTP ${response.status}`);
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 1048576) fail('GitHub observation exceeds the 1 MiB metadata budget');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function transportObservation(target, tlsVersion) {
  const head = (url, secure) => new Promise((resolve, reject) => {
    const request = (secure ? httpsRequest : httpRequest)(url, {
      method: 'HEAD', agent: false, signal: AbortSignal.timeout(30000),
      ...(secure ? { minVersion: tlsVersion, maxVersion: tlsVersion, rejectUnauthorized: true } : {}),
    }, response => {
      const observed = { status: response.statusCode, location: response.headers.location ?? null,
        tls_version: secure ? response.socket.getProtocol() : null,
        authorized: secure ? response.socket.authorized : null };
      response.destroy();
      resolve(observed);
    });
    request.on('error', reject);
    request.end();
  });
  const insecure = new URL(target);
  insecure.protocol = 'http:';
  return Promise.all([head(insecure, false), head(target, true)]).then(([http, https]) => ({
    http_status: http.status, location: http.location, https_status: https.status,
    tls_version: https.tls_version, authorized: https.authorized,
  }));
}

export async function capturePagesSnapshot(context, policy, token) {
  validateContext(context, policy);
  const snapshot = {};
  const failures = [];
  const capture = async (key, operation) => {
    try { snapshot[key] = await operation; }
    catch (error) { failures.push(`${key}: ${error.message}`); }
  };
  await Promise.all([
    capture('main', githubJson('/git/ref/heads/main', token)), capture('pages', githubJson('/pages', token)),
    capture('run', githubJson(`/actions/runs/${context.run_id}`, token)),
    capture('deployments', githubJson('/deployments?environment=github-pages&per_page=1', token)),
    capture('transport', transportObservation(context.target, policy.https_enforcement.tls_version)),
  ]);
  if (Array.isArray(snapshot.deployments) && snapshot.deployments.length === 1 && positive(snapshot.deployments[0]?.id)) {
    await capture('statuses', githubJson(`/deployments/${snapshot.deployments[0].id}/statuses?per_page=1`, token));
  } else {
    failures.push('latest Pages deployment is absent or ambiguous');
  }
  const log = snapshot.statuses?.length === 1 ? snapshot.statuses[0]?.log_url : undefined;
  const jobPrefix = `https://github.com/${repository}/actions/runs/${context.run_id}/job/`;
  if (typeof log === 'string' && log.startsWith(jobPrefix) && /^[1-9][0-9]*$/.test(log.slice(jobPrefix.length))
    && positive(Number(log.slice(jobPrefix.length)))) {
    await capture('job', githubJson(`/actions/jobs/${log.slice(jobPrefix.length)}`, token));
  } else {
    failures.push('latest status does not identify a publisher job in this run');
  }
  // Re-read mutable metadata after transport and job capture. A snapshot taken
  // before a slow request cannot establish that this deployment is still current.
  snapshot.final = {};
  const finalCapture = async (key, path) => {
    try { snapshot.final[key] = await githubJson(path, token); }
    catch (error) { failures.push(`final ${key}: ${error.message}`); }
  };
  await Promise.all([
    finalCapture('main', '/git/ref/heads/main'), finalCapture('run', `/actions/runs/${context.run_id}`),
    finalCapture('deployments', '/deployments?environment=github-pages&per_page=1'),
  ]);
  const finalId = snapshot.final.deployments?.length === 1 ? snapshot.final.deployments[0]?.id : undefined;
  if (positive(finalId)) await finalCapture('statuses', `/deployments/${finalId}/statuses?per_page=1`);
  else failures.push('final latest Pages deployment is absent or ambiguous');
  if (failures.length) {
    const error = new Error(`PS-01: Pages capture failed: ${failures.join('; ')}`);
    error.snapshot = snapshot;
    throw error;
  }
  return snapshot;
}
