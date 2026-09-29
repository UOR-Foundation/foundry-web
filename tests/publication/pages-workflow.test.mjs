// PP-01: source wiring regressions, never a successful deployment or acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseAllDocuments, stringify } from 'yaml';

const source = readFileSync('.github/workflows/pages.yml', 'utf8');
const checkout = 'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683';
const eventRevision = '${{ github.event.workflow_run.head_sha || github.sha }}';
const exportedRevision = '${{ needs.export.outputs.revision }}';
const sdkImage = '${{ needs.export.outputs.sdk-image }}';
const token = '${{ github.token }}';

// The complete audited shell blocks are byte-bound, not matched by snippets.
// A comment or an extra command cannot satisfy or extend these contracts.
const identity = String.raw`set -euo pipefail
test "$PUBLISH_SHA" = "$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq '.object.sha')"
gh api "repos/$GITHUB_REPOSITORY/actions/workflows/bootstrap.yml/runs?head_sha=$PUBLISH_SHA&status=success&per_page=100" |
  jq -e --arg sha "$PUBLISH_SHA" --arg repo "$GITHUB_REPOSITORY" \
    'any(.workflow_runs[]; .head_sha == $sha and .head_branch == "main" and .head_repository.full_name == $repo and (.event == "push" or .event == "workflow_dispatch") and .conclusion == "success")'
image=$(sed -n 's/.*"sdk_image":"\([^"]*\)".*/\1/p' prismpm.lock)
[[ $image =~ ^[a-z0-9.-]+(:[0-9]{1,5})?/[a-z0-9./_-]+@sha256:[0-9a-f]{64}$ ]]
printf 'revision=%s\nsdk-image=%s\n' "$PUBLISH_SHA" "$image" >> "$GITHUB_OUTPUT"
`;
const exportBrowser = String.raw`set -euo pipefail
docker pull "$SDK_IMAGE"
chmod go-w "$PWD"
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$PWD,target=/workspace" --workdir /workspace \
  --entrypoint bash "$SDK_IMAGE" scripts/export_browser.sh site
`;
const currentMain = String.raw`set -euo pipefail
test "$PUBLISH_SHA" = "$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq '.object.sha')"
`;
const observation = String.raw`set -euo pipefail
chmod go-w "$PWD"
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --user "$(id -u):$(id -g)" \
  --env GH_TOKEN --env GITHUB_REPOSITORY --env GITHUB_RUN_ID --env GITHUB_RUN_ATTEMPT \
  --env PUBLISH_SHA --env PAGES_DEPLOYED_URL \
  --mount "type=bind,source=$PWD,target=/workspace" --workdir /workspace \
  --entrypoint node "$SDK_IMAGE" scripts/observe-pages.mjs
`;
const finalObservation = observation.replace('--env PUBLISH_SHA --env PAGES_DEPLOYED_URL',
  '--env PUBLISH_SHA --env PAGES_DEPLOYED_URL --env PAGES_OBSERVATION_PHASE');
const liveIntegrity = String.raw`set -euo pipefail
chmod go-w "$PWD"
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$PWD,target=/workspace" --workdir /workspace \
  --entrypoint node "$SDK_IMAGE" scripts/verify-publication.mjs
`;
const browserAudit = String.raw`set -euo pipefail
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$PWD,target=/workspace" --workdir /workspace \
  --entrypoint bash "$SDK_IMAGE" -c \
  'npm ci --cache /tmp/foundry-publisher-npm --ignore-scripts --no-audit --no-fund && npm run audit:deployed -- --selected'
`;
const observationEnv = {
  SDK_IMAGE: sdkImage, GH_TOKEN: token, PUBLISH_SHA: exportedRevision,
  PAGES_DEPLOYED_URL: '${{ needs.publish.outputs.page-url }}',
};
const expected = {
  name: 'pages publication',
  on: { workflow_run: { workflows: ['bootstrap'], types: ['completed'], branches: ['main'] }, workflow_dispatch: null },
  permissions: {}, concurrency: { group: 'pages', 'cancel-in-progress': false },
  jobs: {
    export: {
      name: 'verify / immutable producer export',
      if: "(github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main') || "
        + "(github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' &&\n"
        + " github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main' &&\n"
        + ' github.event.workflow_run.head_repository.full_name == github.repository)',
      'runs-on': 'ubuntu-24.04', 'timeout-minutes': 45,
      permissions: { contents: 'read', actions: 'read' },
      outputs: { revision: '${{ steps.identity.outputs.revision }}', 'sdk-image': '${{ steps.identity.outputs.sdk-image }}' },
      steps: [
        { name: 'Check out the exact event revision without credentials', uses: checkout,
          with: { ref: eventRevision, 'fetch-depth': 0, 'persist-credentials': false } },
        { name: 'Require successful complete bootstrap on this exact current main revision', id: 'identity',
          env: { GH_TOKEN: token, PUBLISH_SHA: eventRevision }, run: identity },
        { name: 'Export and verify unchanged browser artifacts',
          env: { SDK_IMAGE: '${{ steps.identity.outputs.sdk-image }}' }, run: exportBrowser },
        { name: 'Upload Pages artifact', uses: 'actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa',
          with: { path: 'site' } },
      ],
    },
    publish: {
      name: 'publish / github-pages', needs: 'export', 'runs-on': 'ubuntu-24.04', 'timeout-minutes': 10,
      outputs: { 'page-url': '${{ steps.deployment.outputs.page_url }}' },
      permissions: { contents: 'read', pages: 'write', 'id-token': 'write' },
      environment: { name: 'github-pages', url: '${{ steps.deployment.outputs.page_url }}' },
      steps: [
        { name: 'Refuse a superseded main revision before privileged deployment',
          env: { GH_TOKEN: token, PUBLISH_SHA: exportedRevision }, run: currentMain },
        { name: 'Deploy to GitHub Pages', id: 'deployment', uses: 'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e' },
      ],
    },
    'audit-live': {
      name: 'audit / deployed application (not acceptance)', needs: ['export', 'publish'],
      'runs-on': 'ubuntu-24.04', 'timeout-minutes': 15,
      permissions: { contents: 'read', pages: 'read', deployments: 'read', actions: 'read' },
      steps: [
        { uses: checkout, with: { ref: exportedRevision, 'fetch-depth': 0, 'persist-credentials': false } },
        { name: 'Observe the exact Pages deployment and enforced HTTPS target', env: observationEnv, run: observation },
        { name: 'Replay exact live byte integrity through the locked SDK', env: { SDK_IMAGE: sdkImage }, run: liveIntegrity },
        { name: 'Audit public assets and every visible view in three browser engines', env: { SDK_IMAGE: sdkImage }, run: browserAudit },
        { name: 'Reobserve current deployment after all live audits',
          env: { ...observationEnv, PAGES_OBSERVATION_PHASE: 'final' }, run: finalObservation },
        { name: 'Retain observations and negative-audit diagnostics', if: '${{ !cancelled() }}',
          uses: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
          with: { name: 'publication-observations-${{ github.run_id }}-${{ github.run_attempt }}',
            path: 'reports/', 'if-no-files-found': 'warn', 'retention-days': 14 } },
      ],
    },
  },
};

function parseWorkflow(text) {
  const documents = parseAllDocuments(text, { version: '1.2', schema: 'core', uniqueKeys: true });
  assert.equal(documents.length, 1, 'exactly one workflow document is required');
  assert.deepEqual(documents[0].errors, [], 'malformed or duplicate YAML keys are forbidden');
  assert.deepEqual(documents[0].warnings, [], 'ambiguous YAML is forbidden');
  return documents[0].toJS({ maxAliasCount: 0 });
}
function verifyWorkflow(text) {
  assert.deepEqual(parseWorkflow(text), expected, 'complete parsed Pages workflow differs from its reviewed contract');
}

test('actual parsed Pages workflow preserves the complete reviewed publication graph', () => {
  verifyWorkflow(source);
});

const mutations = [
  ['missing export', w => { delete w.jobs.export; }],
  ['missing publish', w => { delete w.jobs.publish; }],
  ['missing live audit', w => { delete w.jobs['audit-live']; }],
  ['extra job', w => { w.jobs.bypass = { 'runs-on': 'ubuntu-latest', steps: [{ run: 'true' }] }; }],
  ['job continue-on-error', w => { w.jobs.export['continue-on-error'] = true; }],
  ['job omission', w => { w.jobs['audit-live'].if = 'false'; }],
  ['unguarded export', w => { w.jobs.export.if = 'true'; }],
  ['publish before export', w => { delete w.jobs.publish.needs; }],
  ['audit before publish', w => { w.jobs['audit-live'].needs = ['export']; }],
  ['non-bootstrap trigger', w => { w.on.workflow_run.workflows = ['preview']; }],
  ['incomplete bootstrap trigger', w => { w.on.workflow_run.types = ['requested']; }],
  ['wrong trigger branch', w => { w.on.workflow_run.branches = ['other']; }],
  ['write default permissions', w => { w.permissions = 'write-all'; }],
  ['Pages privilege in export', w => { w.jobs.export.permissions.pages = 'write'; }],
  ['Pages privilege in audit', w => { w.jobs['audit-live'].permissions.pages = 'write'; }],
  ['removed deployment privilege', w => { delete w.jobs.publish.permissions['id-token']; }],
  ['wrong protected environment', w => { w.jobs.publish.environment.name = 'other'; }],
  ['missing page URL output', w => { delete w.jobs.publish.outputs['page-url']; }],
  ['substituted page URL output', w => { w.jobs.publish.outputs['page-url'] = 'https://example.invalid/'; }],
  ['concurrent cancellation', w => { w.concurrency['cancel-in-progress'] = true; }],
  ['mutable export checkout', w => { w.jobs.export.steps[0].with.ref = 'main'; }],
  ['mutable audit checkout', w => { w.jobs['audit-live'].steps[0].with.ref = 'main'; }],
  ['retained checkout credentials', w => { w.jobs.export.steps[0].with['persist-credentials'] = true; }],
  ['shallow checkout', w => { w.jobs.export.steps[0].with['fetch-depth'] = 1; }],
  ['mutable action tag', w => { w.jobs.publish.steps[1].uses = 'actions/deploy-pages@v4'; }],
  ['changed full action pin', w => { w.jobs.publish.steps[1].uses = `actions/deploy-pages@${'a'.repeat(40)}`; }],
  ['extra executable step', w => { w.jobs.export.steps.push({ run: 'cargo build --release' }); }],
  ['source compilation', w => { w.jobs.export.steps[2].run += 'cargo build --release\n'; }],
  ['bootstrap failure ignored', w => { w.jobs.export.steps[1]['continue-on-error'] = true; }],
  ['bootstrap command commented out', w => { w.jobs.export.steps[1].run = `# ${identity.split('\n').join('\n# ')}\ntrue\n`; }],
  ['SDK tag substitution', w => { w.jobs.export.steps[2].env.SDK_IMAGE = 'sdk:latest'; }],
  ['different uploaded tree', w => { w.jobs.export.steps[3].with.path = 'other'; }],
  ['missing privileged main recheck', w => { w.jobs.publish.steps.shift(); }],
  ['missing initial observation', w => { w.jobs['audit-live'].steps.splice(1, 1); }],
  ['missing byte audit', w => { w.jobs['audit-live'].steps.splice(2, 1); }],
  ['missing browser audit', w => { w.jobs['audit-live'].steps.splice(3, 1); }],
  ['missing final observation', w => { w.jobs['audit-live'].steps.splice(4, 1); }],
  ['reordered final observation', w => { const steps = w.jobs['audit-live'].steps; [steps[3], steps[4]] = [steps[4], steps[3]]; }],
  ['ignored observation failure', w => { w.jobs['audit-live'].steps[1]['continue-on-error'] = true; }],
  ['omitted observer', w => { w.jobs['audit-live'].steps[1].if = 'false'; }],
  ['caller target substitution', w => { w.jobs['audit-live'].steps[1].env.PAGES_DEPLOYED_URL = 'https://example.invalid/'; }],
  ['caller revision substitution', w => { w.jobs['audit-live'].steps[1].env.PUBLISH_SHA = 'main'; }],
  ['unbound observer revision', w => { w.jobs['audit-live'].steps[1].run = observation.replace('--env PUBLISH_SHA ', ''); }],
  ['unbound observer run', w => { w.jobs['audit-live'].steps[1].run = observation.replace('--env GITHUB_RUN_ID ', ''); }],
  ['unbound observer attempt', w => { w.jobs['audit-live'].steps[1].run = observation.replace('--env GITHUB_RUN_ATTEMPT ', ''); }],
  ['missing final phase', w => { delete w.jobs['audit-live'].steps[4].env.PAGES_OBSERVATION_PHASE; }],
  ['unpropagated final phase', w => { w.jobs['audit-live'].steps[4].run = observation; }],
  ['browser audit on ignored status', w => { w.jobs['audit-live'].steps[3].run = browserAudit.replace(' && npm run', '; npm run'); }],
  ['unchecked additional environment', w => { w.jobs['audit-live'].env = { NODE_OPTIONS: '--import=./bypass.mjs' }; }],
];
for (const [name, mutate] of mutations) {
  test(`parsed workflow rejects ${name}`, () => {
    verifyWorkflow(source);
    const changed = parseWorkflow(source);
    mutate(changed);
    assert.notDeepEqual(changed, parseWorkflow(source), 'the planted defect must change the actual workflow');
    assert.throws(() => verifyWorkflow(stringify(changed)));
  });
}
test('parsed workflow refuses duplicate keys, aliases and multiple documents', () => {
  assert.equal(mutations.length, 49, 'the complete planted-defect inventory must remain present');
  assert.equal(new Set(mutations.map(([name]) => name)).size, 49, 'defect identities must remain distinct');
  verifyWorkflow(source);
  const aliased = source
    .replace('SDK_IMAGE: ${{ needs.export.outputs.sdk-image }}',
      'SDK_IMAGE: &locked_sdk ${{ needs.export.outputs.sdk-image }}')
    .replace('SDK_IMAGE: ${{ needs.export.outputs.sdk-image }}', 'SDK_IMAGE: *locked_sdk');
  assert.throws(() => parseWorkflow(aliased), /alias|resource|exhaustion/i,
    'even aliases with identical expanded values must be refused by the parser');
  for (const changed of [source + '\npermissions: write-all\n',
    source + '\nextra: &extra {a: 1}\ncopy: *extra\n', source + '\n---\nname: other\n']) {
    assert.throws(() => verifyWorkflow(changed));
  }
});
