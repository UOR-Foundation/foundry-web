// Shared publication infrastructure; no application logic or trust substitute.
import { readFileSync, lstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const digest = value => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
function closed(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}
export function sdk(...args) {
  const result = spawnSync('prismpm', ['--json', ...args], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20 * 60 * 1000,
  });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`locked SDK ${args[0]} failed: ${result.error?.message ?? result.stderr ?? result.signal}`);
  }
  return JSON.parse(result.stdout);
}
export function regular(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Not a singly-linked regular file: ${path}`);
  return readFileSync(path);
}
export function selectedProducer() {
  const selection = JSON.parse(regular('model/publication.json'));
  if (selection.schema !== 'foundry/publication-selection/1'
    || selection.target !== 'https://uor-foundation.github.io/foundry-web/') throw new Error('Unreviewed publication target or schema');
  const release = selection.release;
  if (!release) throw new Error('No accepted immutable producer release is selected; application publication is refused');
  if (!/^ghcr\.io\/uor-foundation\/uor-foundry@sha256:[0-9a-f]{64}$/.test(release.reference ?? '')
    || !['policy_digest', 'model_digest', 'build_digest', 'tree_digest'].every(key => digest(release[key]))) {
    throw new Error('Producer selection must bind the reviewed repository and exact release, signing policy, model, build, and browser-tree digests');
  }
  return selection;
}
export function verifyProducer(release) {
  sdk('lock', 'check');
  sdk('pull', release.reference);
  const trust = sdk('verify-release', release.reference);
  // Containment/republication only. First publication still needs the complete
  // SDK-owned prepublication admission; a candidate signature is not authority.
  if (!closed(trust, ['schema', 'verified', 'status', 'release_digest', 'policy_digest',
    'release_signatures', 'promotion_signatures', 'deployment_evidence_signatures'])
    || trust.schema !== 'prismpm/signature-closure-result/1' || trust.verified !== true
    || trust.status !== 'accepted' || trust.release_digest !== release.reference.split('@')[1]
    || trust.policy_digest !== release.policy_digest || trust.release_signatures !== 1
    || !['promotion_signatures', 'deployment_evidence_signatures']
      .every(key => Number.isSafeInteger(trust[key]) && trust[key] >= 0)) {
    throw new Error('Release signature closure is not accepted for the selected producer');
  }
  return trust;
}

// Defend the wrapper against a changed SDK response contract. The SDK still owns
// source-free replay, signatures and actual HTTPS transport; this is no oracle.
export function bindBrowserReceipt(receipt, release, { output, target }) {
  const live = target !== undefined;
  const keys = ['schema', 'reference', 'release_digest', 'model_digest', 'build_digest', 'tree_digest', 'files',
    ...(live ? ['scope', 'url', 'requests', 'redirects'] : ['output'])];
  if (!closed(receipt, keys)
    || receipt.schema !== (live ? 'prismpm/browser-publication-integrity/1' : 'prismpm/browser-export/1')
    || receipt.reference !== release.reference || receipt.release_digest !== release.reference.split('@')[1]
    || !['model_digest', 'build_digest', 'tree_digest'].every(key => receipt[key] === release[key])
    || (live ? receipt.url !== target || receipt.scope !== 'browser-byte-integrity-only'
      || receipt.requests !== 7 || receipt.redirects !== 0 : receipt.output !== output)
    || !Array.isArray(receipt.files) || receipt.files.length !== 6) {
    throw new Error('Browser receipt is not bound to the selected release and operation');
  }
  const maximum = live ? 67108864 : 10737418240;
  if (receipt.files.some(file => !closed(file, ['path', 'digest', 'size'])
    || typeof file.path !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,255}$/.test(file.path)
    || !digest(file.digest) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > maximum)) {
    throw new Error('Browser receipt has an invalid file descriptor');
  }
  const paths = receipt.files.map(file => file.path);
  const stems = paths.filter(path => path.endsWith('_bg.wasm')).map(path => path.slice(0, -8));
  const expected = stems.length === 1 && /^[A-Za-z0-9_]+$/.test(stems[0])
    ? ['app.css', 'app.js', 'index.html', 'provenance.json', `${stems[0]}.js`, `${stems[0]}_bg.wasm`].sort() : [];
  if (new Set(paths).size !== 6 || JSON.stringify(paths) !== JSON.stringify(expected)) {
    throw new Error('Browser receipt differs from the exact sorted six-file SDK profile');
  }
  // This closed inventory contains ASCII strings and bounded nonnegative integer
  // sizes only. Its sorted keys match the SDK's canonical file-descriptor bytes.
  const inventory = receipt.files.map(({ digest, path, size }) => ({ digest, path, size }));
  const tree = `sha256:${createHash('sha256').update(JSON.stringify(inventory)).digest('hex')}`;
  if (tree !== receipt.tree_digest) throw new Error('Browser receipt tree digest does not bind its file inventory');
}
