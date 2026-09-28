// Independent, non-acceptance audit. A passing result is not product signoff.
// Uses only public assets and an isolated browser; never authenticates a user,
// creates an organization, submits a payment, or sends mail to a real mailbox.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { regular, selectedProducer, bindBrowserReceipt } from '../../scripts/publication-sdk.mjs';
import { captureLiveAsset } from '../../scripts/live-assets.mjs';

if (process.argv.length > 3) throw new Error('Expected one URL or --selected');
const selected = process.argv[2] === '--selected' ? selectedProducer() : null;
const target = new URL(selected?.target ?? process.argv[2] ?? 'https://uor-foundation.github.io/foundry-web/');
if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash
  || !target.pathname.endsWith('/')) throw new Error('Expected an explicit HTTPS application base URL');
const integrity = selected ? JSON.parse(regular('reports/publication/integrity.json')) : null;
if (integrity) bindBrowserReceipt(integrity, selected.release, { target: target.href });
const output = resolve('reports/deployed-audit');
await mkdir(output, { recursive: true });
const report = {
  schema: 'foundry/deployed-audit/1', target: target.href,
  observed_at: new Date().toISOString(), acceptance: 'not-established',
  release_reference: selected?.release.reference ?? null,
  transport: null, assets: [], browsers: [], failures: [],
};
const failure = (boundary, message) => report.failures.push({ boundary, message });
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

try {
  const insecure = new URL(target);
  insecure.protocol = 'http:';
  const response = await fetch(insecure, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  const location = response.headers.get('location');
  report.transport = { http_status: response.status, location };
  if (response.body) await response.body.cancel();
  if (![301, 302, 303, 307, 308].includes(response.status) || !location
    || new URL(location, insecure).href !== target.href) {
    failure('transport', 'HTTP does not redirect to the exact HTTPS application target');
  }
} catch (error) { failure('transport', `HTTP upgrade was not established: ${error.message}`); }

// The unbound diagnostic inspects the audited legacy deployment only. CI must
// use the actual SDK inventory, never the legacy filenames as an output model.
const paths = integrity ? integrity.files.map(file => file.path)
  : ['index.html', 'foundry.js', 'foundry.css', 'foundry_bg.wasm', 'holo_runtime.holo', 'manifest.json'];
for (const path of paths) {
  try {
    const expected = integrity?.files.find(file => file.path === path);
    const { bytes, digest, status, contentType } = await captureLiveAsset(new URL(path, target),
      { expectedSize: expected?.size ?? null });
    report.assets.push({ path, status, size: bytes.length, digest, content_type: contentType });
    if (status < 200 || status > 299) failure('assets', `${path}: HTTP ${status}`);
    if (expected && (bytes.length !== expected.size || digest !== expected.digest)) {
      failure('assets', `${path}: bytes differ from the independently verified release observation`);
    }
    if (path.endsWith('.wasm')) {
      const exports = WebAssembly.Module.exports(new WebAssembly.Module(bytes));
      if (!exports.some(item => item.kind === 'function')) failure('runtime', 'Wasm exports no executable function');
    }
    // This detects the known forged header; actual format acceptance belongs to
    // the pinned hologram-live executor, NOT an alternate publisher parser.
    if (path.endsWith('.holo') && bytes.equals(Buffer.from([72, 79, 76, 79, 1, 0, 0, 0]))) {
      failure('holo', 'Published artifact is the fabricated eight-byte HOLO header');
    }
  } catch (error) { failure('assets', `${path}: ${error.message}`); }
}

for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const result = { name, page_errors: [], external_requests: [], views: [] };
  report.browsers.push(result);
  let browser;
  try {
    browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    // Prevent this negative audit from sending mailbox or other user operations
    // to an external provider. Positive interoperability needs its own evidence.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === target.origin) return route.continue();
      result.external_requests.push({ origin: url.origin, method: route.request().method() });
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => result.page_errors.push(error.message));
    await page.goto(target.href, { waitUntil: 'networkidle', timeout: 30000 });
    result.title = await page.title();
    result.exposed_mutable_state = await page.evaluate(() => !!window.uorFoundry?.state);
    if (result.exposed_mutable_state) failure(name, 'Production page exposes mutable authorization/application state through a test harness');

    for (const [viewport, size] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
      await page.setViewportSize(size);
      const tabs = await page.getByRole('tab').count();
      for (let index = 0; index < Math.max(tabs, 1); index++) {
        if (tabs) await page.getByRole('tab').nth(index).click();
        const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
        const view = { viewport, index,
          label: tabs ? await page.getByRole('tab').nth(index).innerText() : 'page',
          violations: audit.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) })),
          incomplete: audit.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })),
          horizontal_overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        };
        result.views.push(view);
        if (view.violations.length) failure(name, `${viewport}/${view.label}: ${view.violations.length} automated accessibility violations`);
        if (view.horizontal_overflow) failure(name, `${viewport}/${view.label}: page overflows viewport horizontally`);
        if (index === 0) await page.screenshot({ path: `${output}/${name}-${viewport}.png`, fullPage: true });
      }
    }

    // The current UI fills its own supposed mailbox proof. Observe the defect
    // without pressing Verify, establishing a session, or creating an account.
    const enrollment = page.locator('#tab-identity');
    if (await enrollment.count()) {
      await enrollment.click();
      await page.locator('#enroll-email').fill('audit@example.invalid');
      await page.locator('#btn-send-challenge').click();
      await page.waitForFunction(() => document.querySelector('#verify-nonce')?.value
        || document.querySelector('[role="alert"]')?.textContent, undefined, { timeout: 3000 }).catch(() => {});
      result.mailbox_proof_prefilled = !!(await page.locator('#verify-nonce').inputValue());
      if (result.mailbox_proof_prefilled) failure(name, 'Enrollment manufactures mailbox proof locally for a reserved invalid domain');
    }
    if (result.page_errors.length) failure(name, `${result.page_errors.length} unhandled page errors`);
  } catch (error) { failure(name, error.message); }
  finally { if (browser) await browser.close(); }
  console.log(`${name}: audit recorded; not production acceptance`);
}
await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ target: report.target, failures: report.failures, report: `${output}/report.json`, acceptance: report.acceptance }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
