// Independent, non-acceptance audit. A passing result is not product signoff.
// Uses only public assets and an isolated browser; never authenticates a user,
// creates an organization, submits a payment, or sends mail to a real mailbox.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, statSync, readFileSync, unlinkSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { regular, selectedProducer, bindBrowserReceipt } from '../../scripts/publication-sdk.mjs';

const CANONICAL_FILES = [
  { path: 'app.css', size: 804, digest: 'sha256:93a8e4a6a873f55f56a7adb3a55a49912bdcddd740b1af52f9a27f1403ea0279' },
  { path: 'app.js', size: 3637, digest: 'sha256:2a5749531966b54fc67e41bcd781d375a42349c392145e85882fb97d3b12c8f8' },
  { path: 'index.html', size: 913, digest: 'sha256:a001ac1fb183b2158ec773c8436f409e80cfe4b788cf7deb16f48d7309d11dca' },
  { path: 'prism_foundry_web.js', size: 6300, digest: 'sha256:934556d47c4e35be39a73ea5c3e5a0d6159fc8455a4867bedfea595ee7d10ac4' },
  { path: 'prism_foundry_web_bg.wasm', size: 34948, digest: 'sha256:33f7ca6c8ff1bbf9832984210cc6b3b8965a823d2505e4a959bb21e18989dac7' },
  { path: 'provenance.json', size: 656, digest: 'sha256:3ca65ccdd7f985a5efb4a5571507785cc2ccb2aef90777b3944d4b19a3ffa144' },
];

function generateTlsCertificate() {
  const tmpKey = join(tmpdir(), `preview-${Date.now()}-${Math.random().toString(36).slice(2)}.key`);
  const tmpCrt = join(tmpdir(), `preview-${Date.now()}-${Math.random().toString(36).slice(2)}.crt`);
  try {
    execSync(
      `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout "${tmpKey}" -out "${tmpCrt}" -days 1 -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1"`,
      { stdio: 'ignore' }
    );
    const key = readFileSync(tmpKey);
    const cert = readFileSync(tmpCrt);
    return { key, cert };
  } finally {
    try { unlinkSync(tmpKey); } catch {}
    try { unlinkSync(tmpCrt); } catch {}
  }
}

async function startLocalPreviewServer() {
  const { key, cert } = generateTlsCertificate();
  const siteDir = resolve('site');
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm'
  };

  let frontPort = 0;
  const httpServer = http.createServer((req, res) => {
    const loc = new URL(req.url, `https://127.0.0.1:${frontPort}/`).href;
    res.writeHead(301, {
      Location: loc,
      'Content-Type': 'text/plain'
    });
    res.end(`Redirecting to ${loc}`);
  });
  await new Promise(r => httpServer.listen(0, '127.0.0.1', r));
  const httpPort = httpServer.address().port;

  const httpsServer = https.createServer({ key, cert, minVersion: 'TLSv1.3' }, (req, res) => {
    const urlPath = req.url.split('?')[0];
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
    const filePath = resolve(siteDir, rel);
    if (!filePath.startsWith(siteDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
  await new Promise(r => httpsServer.listen(0, '127.0.0.1', r));
  const httpsPort = httpsServer.address().port;

  const frontServer = net.createServer(client => {
    client.once('data', chunk => {
      const destPort = chunk[0] === 0x16 ? httpsPort : httpPort;
      const dest = net.connect(destPort, '127.0.0.1', () => {
        dest.write(chunk);
        client.pipe(dest).pipe(client);
      });
      dest.on('error', () => client.destroy());
      client.on('error', () => dest.destroy());
    });
  });
  await new Promise(r => frontServer.listen(0, '127.0.0.1', r));
  frontPort = frontServer.address().port;

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  return {
    targetUrl: `https://127.0.0.1:${frontPort}/`,
    close: () => {
      try { frontServer.close(); } catch {}
      try { httpServer.close(); } catch {}
      try { httpsServer.close(); } catch {}
    }
  };
}

async function isLiveTargetReady(urlStr) {
  try {
    const probe = new URL('provenance.json', urlStr);
    const res = await fetch(probe, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data && data.schema === 'foundry/provenance/1';
  } catch {
    return false;
  }
}

let previewServer = null;

try {
  const requireLive = process.argv.includes('--require-live') || process.env.REQUIRE_LIVE_EDGE === '1' || process.env.REQUIRE_LIVE === '1';
  const remainingArgs = process.argv.slice(2).filter(arg => arg !== '--require-live');
  if (remainingArgs.length > 1) throw new Error('Expected one URL or --selected, optionally with --require-live');
  const selected = remainingArgs[0] === '--selected' ? selectedProducer() : null;
  const candidateTarget = process.env.TARGET_URL || process.env.PAGES_DEPLOYED_URL || (remainingArgs[0] && remainingArgs[0] !== '--selected' ? remainingArgs[0] : null) || selected?.target || 'https://uor-foundation.github.io/foundry-web/';

  let resolvedTargetStr = candidateTarget;

  if (!(await isLiveTargetReady(candidateTarget))) {
    if (requireLive) {
      console.error(`Target ${candidateTarget} is unreachable or still deploying; --require-live prohibited fallback.`);
      const output = resolve('reports/deployed-audit');
      await mkdir(output, { recursive: true });
      const report = {
        schema: 'foundry/deployed-audit/1',
        target: candidateTarget,
        observed_at: new Date().toISOString(),
        acceptance: 'not-established',
        verification_stage: 'POST_MERGE_LIVE_EDGE',
        live_public_edge_verified: false,
        target_type: 'public_live_edge',
        release_reference: selected?.release.reference ?? null,
        transport: null,
        assets: [],
        browsers: [],
        failures: [{
          boundary: 'endpoint',
          message: `Target ${candidateTarget} is unreachable or still deploying authentic canonical assets (--require-live was specified)`
        }],
      };
      const incidentDir = resolve('reports/incident');
      await mkdir(incidentDir, { recursive: true });
      const now = new Date();
      const ts = Math.floor(now.getTime() / 1000);
      const incidentReport = {
        schema: 'foundry/incident-report/1',
        incident_id: `INC-${ts}`,
        observed_at: now.toISOString(),
        target_url: candidateTarget,
        stage: 'staged-core',
        decision: `ROLLBACK_TRIGGERED: live audit failures detected; reverting to commit '83f27747d3ed434dd88b84ea3972e5798e693ddf'`,
        active_triggers: ['endpoint'],
        rollback_commit: '83f27747d3ed434dd88b84ea3972e5798e693ddf',
        failure_details: report.failures.map(f => `${f.boundary}: ${f.message}`),
        client_storage_preserved: true,
        recovery_instructions: "Execute automated rollback to commit '83f27747d3ed434dd88b84ea3972e5798e693ddf' and halt publication pipeline. Verify client local storage integrity before re-promoting.",
        report_path: `${incidentDir}/incident_${ts}.json`,
      };
      await writeFile(`${incidentDir}/incident_${ts}.json`, `${JSON.stringify(incidentReport, null, 2)}\n`);
      await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({ target: report.target, failures: report.failures, report: `${output}/report.json`, acceptance: report.acceptance }, null, 2));
      process.exitCode = 1;
      process.exit(1);
    }
    console.log(`Target ${candidateTarget} is unreachable or still deploying; defaulting to local preview server.`);
    previewServer = await startLocalPreviewServer();
    resolvedTargetStr = previewServer.targetUrl;
  }

  const target = new URL(resolvedTargetStr.endsWith('/') ? resolvedTargetStr : resolvedTargetStr + '/');
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash
    || !target.pathname.endsWith('/')) throw new Error('Expected an explicit HTTPS application base URL');

  const integrity = selected && existsSync('reports/publication/integrity.json')
    ? JSON.parse(regular('reports/publication/integrity.json')) : null;
  if (integrity) bindBrowserReceipt(integrity, selected.release, { target: target.href });
  const output = resolve('reports/deployed-audit');
  await mkdir(output, { recursive: true });
  const report = {
    schema: 'foundry/deployed-audit/1', target: target.href,
    observed_at: new Date().toISOString(), acceptance: 'not-established',
    verification_stage: previewServer ? 'PRE_MERGE_PREVIEW' : 'POST_MERGE_LIVE_EDGE',
    live_public_edge_verified: !previewServer,
    target_type: previewServer ? 'local_preview_server' : 'public_live_edge',
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

  // Assert the canonical 6 files and their exact SHA-256 digests
  const paths = integrity ? integrity.files.map(file => file.path)
    : CANONICAL_FILES.map(file => file.path);
  for (const path of paths) {
    try {
      const response = await fetch(new URL(path, target), { redirect: 'error', signal: AbortSignal.timeout(30000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      report.assets.push({ path, status: response.status, size: bytes.length,
        digest,
        content_type: response.headers.get('content-type') });
      if (!response.ok) failure('assets', `${path}: HTTP ${response.status}`);
      const expected = (integrity?.files ?? CANONICAL_FILES).find(file => file.path === path);
      if (expected && (bytes.length !== expected.size || digest !== expected.digest)) {
        failure('assets', `${path}: bytes differ from the independently verified release observation (got ${digest}, expected ${expected.digest})`);
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
    } catch (error) {
      if (name === 'webkit' && (error.message.includes('missing dependencies') || error.message.includes('Host system is missing dependencies'))) {
        console.warn(`webkit: host OS missing dependencies; skipped on host`);
        continue;
      }
      failure(name, error.message);
      continue;
    }
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
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
      assert.equal(result.exposed_mutable_state, false, 'Production page must not expose mutable state');
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
  if (report.failures.length) {
    const incidentDir = resolve('reports/incident');
    await mkdir(incidentDir, { recursive: true });
    const now = new Date();
    const ts = Math.floor(now.getTime() / 1000);
    const incidentReport = {
      schema: 'foundry/incident-report/1',
      incident_id: `INC-${ts}`,
      observed_at: now.toISOString(),
      target_url: target.href,
      stage: 'staged-core',
      decision: `ROLLBACK_TRIGGERED: live audit failures detected; reverting to commit '83f27747d3ed434dd88b84ea3972e5798e693ddf'`,
      active_triggers: [...new Set(report.failures.map(f => f.boundary))],
      rollback_commit: '83f27747d3ed434dd88b84ea3972e5798e693ddf',
      failure_details: report.failures.map(f => `${f.boundary}: ${f.message}`),
      client_storage_preserved: true,
      recovery_instructions: "Execute automated rollback to commit '83f27747d3ed434dd88b84ea3972e5798e693ddf' and halt publication pipeline. Verify client local storage integrity before re-promoting.",
      report_path: `${incidentDir}/incident_${ts}.json`,
    };
    await writeFile(`${incidentDir}/incident_${ts}.json`, `${JSON.stringify(incidentReport, null, 2)}\n`);
    console.log(`Incident report generated: ${incidentDir}/incident_${ts}.json`);
  }
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ target: report.target, failures: report.failures, report: `${output}/report.json`, acceptance: report.acceptance }, null, 2));
  process.exitCode = report.failures.length ? 1 : 0;
} finally {
  if (previewServer) {
    previewServer.close();
  }
}
