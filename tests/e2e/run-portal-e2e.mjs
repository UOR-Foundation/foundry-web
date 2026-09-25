// tests/e2e/run-portal-e2e.mjs
// End-to-end browser and WCAG 2.2 Level AA accessibility tests for UOR Foundry Portal.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, firefox } = require('/home/alex/Desktop/uor-foundry/node_modules/@playwright/test');
const AxeBuilder = require('/home/alex/Desktop/uor-foundry/node_modules/@axe-core/playwright');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const siteDir = join(__dirname, '..', '..', 'site');

assert.ok(existsSync(siteDir), 'site directory must exist');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/manifest+json',
  '.holo': 'application/octet-stream',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  let pathname = url.pathname;

  if (pathname.startsWith('/foundry-web/')) {
    pathname = pathname.slice('/foundry-web/'.length);
  }
  if (!pathname || pathname === '/') {
    pathname = 'index.html';
  }

  const filePath = join(siteDir, pathname);
  if (!existsSync(filePath)) {
    res.writeHead(404).end('Not Found');
    return;
  }

  const ext = '.' + pathname.split('.').pop();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(readFileSync(filePath));
});

const PORT = 4173;
server.listen(PORT, '127.0.0.1');
console.log(`Test server running at http://127.0.0.1:${PORT}/foundry-web/`);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function runAudit(page, contextName) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  const results = await builder.analyze();

  if (results.violations.length > 0) {
    console.error(`WCAG 2.2 AA violations in ${contextName}:`);
    for (const v of results.violations) {
      console.error(` - [${v.impact}] ${v.id}: ${v.description}`);
      for (const node of v.nodes) {
        console.error(`     Target: ${node.target.join(' ')}`);
        console.error(`     Failure: ${node.failureSummary}`);
      }
    }
    throw new Error(`Accessibility violations found in ${contextName}: ${results.violations.length}`);
  }
  console.log(`  ✓ 0 WCAG 2.2 AA accessibility violations (${contextName})`);
}

async function testBrowser(name, browserEngine) {
  console.log(`\n--- Running E2E Suite on ${name.toUpperCase()} ---`);
  const browser = await browserEngine.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Load Portal
    await page.goto(`http://127.0.0.1:${PORT}/foundry-web/`);
    await page.waitForLoadState('networkidle');

    // Check title and primary landmarks
    const title = await page.title();
    assert.equal(title, 'UOR Foundry Portal');
    console.log('  ✓ Page title verified: "UOR Foundry Portal"');

    const heading = await page.textContent('h1');
    assert.equal(heading.trim(), 'UOR Foundry');
    console.log('  ✓ Primary heading verified: "UOR Foundry"');

    // 2. Initial Accessibility Audit (Desktop)
    await runAudit(page, `${name} - Desktop Initial State`);

    // 3. Test Skip Link
    await page.keyboard.press('Tab');
    const skipLinkFocused = await page.evaluate(() => document.activeElement?.classList.contains('skip-link'));
    assert.ok(skipLinkFocused, 'Skip link must receive initial tab focus');
    await page.keyboard.press('Enter');
    console.log('  ✓ Skip link keyboard navigation verified');

    // 4. Test Service Tabs and Routing
    const services = [
      { id: 'workflows', name: 'Workflows' },
      { id: 'ai-inference', name: 'AI Inference' },
      { id: 'messaging', name: 'Messaging & Collaboration' },
      { id: 'admin', name: 'Admin & Governance' },
      { id: 'finance', name: 'Business & Finance' },
      { id: 'learning', name: 'Learning & Certification' },
      { id: 'brand', name: 'Brand & Presentation' },
    ];

    for (const svc of services) {
      const tabBtn = page.locator(`#tab-${svc.id}`);
      await tabBtn.click();

      // Check aria-selected
      const isSelected = await tabBtn.getAttribute('aria-selected');
      assert.equal(isSelected, 'true', `Tab ${svc.name} must be aria-selected="true"`);

      // Check panel visibility
      const panel = page.locator(`#${svc.id}`);
      const isHidden = await panel.getAttribute('hidden');
      assert.equal(isHidden, null, `Panel ${svc.name} must not be hidden`);

      // Trigger interactive pure-model action
      const actionBtn = panel.locator('.action-btn');
      await actionBtn.click();

      const display = panel.locator('.result-display');
      await page.waitForTimeout(50);
      const text = await display.textContent();
      assert.ok(text.includes('Result:'), `Action output must be displayed: ${text}`);

      console.log(`  ✓ Service view verified: ${svc.name} (interactive dispatch success)`);
    }

    // 5. Test Keyboard Navigation (Arrow Keys across tabs)
    const firstTab = page.locator('#tab-workflows');
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    const focusedTabId = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focusedTabId, 'tab-ai-inference', 'ArrowRight must advance focus to next tab');
    console.log('  ✓ Keyboard tab navigation verified (ArrowRight)');

    // 6. Test Mobile Viewport and Accessibility
    await page.setViewportSize({ width: 320, height: 600 });
    await page.waitForTimeout(100);
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noHorizontalScroll, 'Mobile viewport (320px) must not have horizontal overflow');
    console.log('  ✓ Mobile viewport (320px) responsive layout verified');

    await runAudit(page, `${name} - Mobile Viewport (320px)`);

    // 7. Test Direct Wasm Dispatch API
    const dispatchResult = await page.evaluate(() => {
      return window.uorFoundry?.dispatch('Status: Ready');
    });
    assert.equal(dispatchResult, 'Status: Ready');
    console.log('  ✓ Direct Wasm dispatch acceptance vector verified ("Status: Ready")');

    console.log(`✓ All tests passed on ${name.toUpperCase()}`);
  } finally {
    await browser.close();
  }
}

try {
  await testBrowser('Chromium', chromium);
  await testBrowser('Firefox', firefox);
  console.log('\n========================================');
  console.log('🎉 ALL BROWSER E2E AND ACCESSIBILITY TESTS PASSED!');
  console.log('========================================\n');
} finally {
  server.close();
}
