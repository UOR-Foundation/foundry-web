import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.holo': 'application/octet-stream'
};

const siteDir = resolve('site');

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(siteDir, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath += '.html';
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
    'Service-Worker-Allowed': '/'
  });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/`;

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // Switch to Dark theme
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(100);

  const tabs = [
    'tab-dashboard',
    'tab-identity',
    'tab-backup-codes',
    'tab-organization',
    'tab-projects',
    'tab-workspaces',
    'tab-workflows',
    'tab-ai-inference',
    'tab-messaging',
    'tab-brand'
  ];

  console.log('Auditing all tabs under Dark Theme:');
  const violationsByTab = {};

  for (const tabId of tabs) {
    await page.locator(`#${tabId}`).click();
    await page.waitForTimeout(100);

    const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
    if (audit.violations.length > 0) {
      violationsByTab[tabId] = audit.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => ({
          target: n.target,
          failureSummary: n.failureSummary
        }))
      }));
      console.log(`❌ Tab ${tabId}: ${audit.violations.length} violations`);
    } else {
      console.log(`✅ Tab ${tabId}: 0 violations`);
    }
  }

  console.log('\nAudit summary:');
  console.log(JSON.stringify(violationsByTab, null, 2));

  const totalViolations = Object.values(violationsByTab).reduce((sum, v) => sum + v.length, 0);
  assert.equal(totalViolations, 0, `Expected 0 violations across all tabs under Dark Theme, got ${totalViolations}`);
  console.log('\n✅ ALL 10 TABS PASSED DARK THEME CONTRAST AUDIT WITH 0 VIOLATIONS.\n');

  await context.close();
  await browser.close();
} finally {
  server.close();
}
