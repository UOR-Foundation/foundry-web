// Independent, non-acceptance audit. A passing result is not product signoff.
// Uses only public assets and an isolated browser; never authenticates a user,
// creates an organization, submits a payment, or sends mail to a real mailbox.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const target = new URL(process.argv[2] ?? 'https://uor-foundation.github.io/foundry-web/');
if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash
  || !target.pathname.endsWith('/')) throw new Error('Expected an explicit HTTPS application base URL');
const output = resolve('reports/deployed-audit');
await mkdir(output, { recursive: true });
const report = {
  schema: 'foundry/deployed-audit/1', target: target.href,
  observed_at: new Date().toISOString(), acceptance: 'not-established',
  assets: [], browsers: [], failures: [],
};
const failure = (boundary, message) => report.failures.push({ boundary, message });
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const path of ['index.html', 'foundry.js', 'foundry.css', 'foundry_bg.wasm', 'holo_runtime.holo', 'manifest.json']) {
  try {
    const response = await fetch(new URL(path, target), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    report.assets.push({ path, status: response.status, size: bytes.length,
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      content_type: response.headers.get('content-type') });
    if (!response.ok) failure('assets', `${path}: HTTP ${response.status}`);
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
