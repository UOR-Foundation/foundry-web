import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePagesSnapshot, validateContext, readPagesPolicy } from '../../scripts/pages-deployment.mjs';

const repository = 'UOR-Foundation/foundry-web';
const target = 'https://uor-foundation.github.io/foundry-web/';
const revision = 'a'.repeat(40);
const context = { repository, target, revision, run_id: 123, run_attempt: 2 };
const snapshot = {
  main: { object: { sha: revision } },
  pages: { html_url: target, build_type: 'workflow', https_enforced: true,
    cname: null, source: { branch: 'main', path: '/' } },
  run: { id: 123, run_attempt: 2, path: '.github/workflows/pages.yml', head_sha: revision,
    head_branch: 'main', event: 'workflow_run', status: 'in_progress', conclusion: null,
    run_started_at: '2026-09-27T00:00:00Z', repository: { full_name: repository },
    head_repository: { full_name: repository } },
  deployments: [{ id: 456, sha: revision, ref: 'main', environment: 'github-pages',
    repository_url: `https://api.github.com/repos/${repository}`,
    performed_via_github_app: { slug: 'github-actions' }, created_at: '2026-09-27T00:01:00Z' }],
  statuses: [{ id: 111, state: 'success', environment: 'github-pages', environment_url: target,
    deployment_url: `https://api.github.com/repos/${repository}/deployments/456`,
    log_url: `https://github.com/${repository}/actions/runs/123/job/789`,
    created_at: '2026-09-27T00:02:00Z' }],
  job: { id: 789, run_id: 123, run_attempt: 2, head_sha: revision, head_branch: 'main',
    name: 'publish / github-pages', status: 'completed', conclusion: 'success',
    html_url: `https://github.com/${repository}/actions/runs/123/job/789` },
  transport: { http_status: 301, location: target, https_status: 200, tls_version: 'TLSv1.3', authorized: true },
};
snapshot.final = structuredClone({ main: snapshot.main, run: snapshot.run,
  deployments: snapshot.deployments, statuses: snapshot.statuses });

// Synthetic inputs exercise refusal semantics, never stand in for an API call,
// successful deployment, TLS handshake, producer verification or acceptance.
test('Pages observation validator reads the actual desired model, not stored deployment facts', () => {
  const policy = readPagesPolicy();
  assert.equal(policy.https_enforcement.tls_version, 'TLSv1.3');
  assert.equal('producer_commit' in policy.artifact_verification, false);
  assert.equal('expected_tree_digest' in policy.artifact_verification, false);
  assert.doesNotThrow(() => validatePagesSnapshot(snapshot, context, policy));
});

for (const [name, mutate] of [
  ['superseded main', s => { s.main.object.sha = 'b'.repeat(40); }],
  ['HTTP target', s => { s.pages.html_url = target.replace('https:', 'http:'); }],
  ['unapproved domain', s => { s.pages.cname = 'example.invalid'; }],
  ['disabled HTTPS', s => { s.pages.https_enforced = false; }],
  ['legacy Pages build', s => { s.pages.build_type = 'legacy'; }],
  ['different Pages branch', s => { s.pages.source.branch = 'other'; }],
  ['different Pages source', s => { s.pages.source.path = '/docs'; }],
  ['wrong workflow run', s => { s.run.id++; }],
  ['old workflow attempt', s => { s.run.run_attempt--; }],
  ['wrong workflow source', s => { s.run.head_sha = 'b'.repeat(40); }],
  ['wrong workflow branch', s => { s.run.head_branch = 'other'; }],
  ['wrong workflow', s => { s.run.path = '.github/workflows/other.yml'; }],
  ['unapproved workflow event', s => { s.run.event = 'pull_request'; }],
  ['fork source', s => { s.run.head_repository.full_name = 'other/foundry-web'; }],
  ['other run repository', s => { s.run.repository.full_name = 'other/foundry-web'; }],
  ['failed workflow', s => { s.run.status = 'completed'; s.run.conclusion = 'failure'; }],
  ['no deployment', s => { s.deployments = []; }],
  ['ambiguous deployment', s => { s.deployments.push(s.deployments[0]); }],
  ['wrong deployment SHA', s => { s.deployments[0].sha = 'b'.repeat(40); }],
  ['wrong deployment ref', s => { s.deployments[0].ref = 'other'; }],
  ['wrong environment', s => { s.deployments[0].environment = 'other'; }],
  ['wrong repository', s => { s.deployments[0].repository_url += '-other'; }],
  ['wrong deployment actor', s => { s.deployments[0].performed_via_github_app.slug = 'other'; }],
  ['old attempt deployment', s => { s.deployments[0].created_at = '2026-09-26T23:59:59Z'; }],
  ['no status', s => { s.statuses = []; }],
  ['ambiguous status', s => { s.statuses.push(s.statuses[0]); }],
  ['inactive deployment', s => { s.statuses[0].state = 'inactive'; }],
  ['wrong status environment', s => { s.statuses[0].environment = 'other'; }],
  ['wrong deployment URL', s => { s.statuses[0].environment_url = 'https://example.invalid/'; }],
  ['wrong status deployment', s => { s.statuses[0].deployment_url += '0'; }],
  ['wrong status run', s => { s.statuses[0].log_url = `https://github.com/${repository}/actions/runs/1230/job/789`; }],
  ['old status', s => { s.statuses[0].created_at = '2026-09-27T00:00:00Z'; }],
  ['invalid timestamp', s => { s.run.run_started_at = 'not a date'; }],
  ['missing final capture', s => { delete s.final; }],
  ['main changes during capture', s => { s.final.main.object.sha = 'b'.repeat(40); }],
  ['attempt changes during capture', s => { s.final.run.run_attempt++; }],
  ['deployment changes during capture', s => { s.final.deployments[0].id++; }],
  ['status changes during capture', s => { s.final.statuses[0].id++; }],
  ['inactive during capture', s => { s.final.statuses[0].state = 'inactive'; }],
  ['missing publisher job', s => { delete s.job; }],
  ['wrong publisher job', s => { s.job.id++; }],
  ['wrong publisher job run', s => { s.job.run_id++; }],
  ['stale publisher job attempt', s => { s.job.run_attempt--; }],
  ['wrong publisher job SHA', s => { s.job.head_sha = 'b'.repeat(40); }],
  ['wrong publisher job branch', s => { s.job.head_branch = 'other'; }],
  ['wrong publisher job name', s => { s.job.name = 'other'; }],
  ['incomplete publisher job', s => { s.job.status = 'in_progress'; }],
  ['failed publisher job', s => { s.job.conclusion = 'failure'; }],
  ['wrong publisher job URL', s => { s.job.html_url += '0'; }],
  ['HTTP remains available', s => { s.transport.http_status = 200; }],
  ['HTTP downgrade', s => { s.transport.location = target.replace('https:', 'http:'); }],
  ['redirected path', s => { s.transport.location = target + 'other'; }],
  ['HTTPS redirect', s => { s.transport.https_status = 302; }],
  ['unapproved TLS', s => { s.transport.tls_version = 'TLSv1.2'; }],
  ['unauthorized certificate', s => { s.transport.authorized = false; }],
]) {
  test(`Pages metadata and transport reject ${name}`, () => {
    const changed = structuredClone(snapshot);
    mutate(changed);
    assert.throws(() => validatePagesSnapshot(changed, context, readPagesPolicy()), /PS-01/);
  });
}
for (const [name, mutate] of [
  ['repository', c => { c.repository = 'other/foundry-web'; }],
  ['action output URL', c => { c.target = target.replace('https:', 'http:'); }],
  ['revision', c => { c.revision = 'main'; }],
  ['run ID', c => { c.run_id = '123'; }],
  ['attempt', c => { c.run_attempt = 0; }],
  ['unknown authority', c => { c.accepted = true; }],
]) {
  test(`Pages context rejects substituted ${name}`, () => {
    const changed = structuredClone(context);
    mutate(changed);
    assert.throws(() => validateContext(changed, readPagesPolicy()), /PS-01/);
  });
}
