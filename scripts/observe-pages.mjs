// Actual GitHub/HTTP/TLS capture only. This cannot accept an application release.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { selectedProducer } from './publication-sdk.mjs';
import { readPagesPolicy, validateContext, capturePagesSnapshot, validatePagesSnapshot } from './pages-deployment.mjs';

const report = { schema: 'foundry/pages-observation/1', scope: 'pages-metadata-and-transport-only',
  acceptance: 'not-established', observed_at: new Date().toISOString(), verified: false };
const phase = process.env.PAGES_OBSERVATION_PHASE ?? 'initial';
const output = phase === 'final' ? 'reports/publication/pages-observation-final.json'
  : 'reports/publication/pages-observation.json';
try {
  if (!['initial', 'final'].includes(phase)) throw new Error('PS-01: invalid observation phase');
  report.phase = phase;
  if (process.argv.length !== 2) throw new Error('PS-01: no caller observations or target overrides are accepted');
  const selection = selectedProducer();
  const context = { repository: process.env.GITHUB_REPOSITORY, target: process.env.PAGES_DEPLOYED_URL,
    revision: process.env.PUBLISH_SHA, run_id: Number(process.env.GITHUB_RUN_ID),
    run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT) };
  const policy = readPagesPolicy();
  validateContext(context, policy);
  if (selection.target !== context.target) throw new Error('PS-01: action output differs from reviewed target');
  const git = (...args) => {
    const result = spawnSync('git', args, { encoding: 'utf8', timeout: 10000, maxBuffer: 1048576 });
    if (result.error || result.signal || result.status !== 0) throw new Error('PS-01: publisher checkout is not intact');
    return result.stdout.trim();
  };
  if (git('rev-parse', 'HEAD') !== context.revision) throw new Error('PS-01: checked-out publisher differs from deployment');
  git('diff', '--exit-code', 'HEAD', '--');
  report.context = context;
  report.release = selection.release;
  report.snapshot = await capturePagesSnapshot(context, policy, process.env.GH_TOKEN);
  validatePagesSnapshot(report.snapshot, context, policy);
  git('diff', '--exit-code', 'HEAD', '--');
  if (git('rev-parse', 'HEAD') !== context.revision) throw new Error('PS-01: publisher changed during observation');
  report.verified = true;
} catch (error) {
  if (error.snapshot) report.snapshot = error.snapshot;
  report.error = error.message;
  console.error(`Pages observation validation error: ${error.message}`);
  process.exitCode = 1;
} finally {
  report.completed_at = new Date().toISOString();
  mkdirSync('reports/publication', { recursive: true });
  writeFileSync(output, `${JSON.stringify(report)}\n`);
  console.log(JSON.stringify({ verified: report.verified, acceptance: report.acceptance,
    report: output }));
}
