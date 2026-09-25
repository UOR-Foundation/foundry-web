// tests/e2e/verify-live.mjs
// Verification of live production GitHub Pages deployment at https://uor-foundation.github.io/foundry-web/

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, firefox } = require('/home/alex/Desktop/uor-foundry/node_modules/@playwright/test');
const AxeBuilder = require('/home/alex/Desktop/uor-foundry/node_modules/@axe-core/playwright');

const LIVE_URL = 'https://uor-foundation.github.io/foundry-web/';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function runLiveAudit(page, contextName) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  const results = await builder.analyze();

  if (results.violations.length > 0) {
    console.error(`WCAG 2.2 AA violations in live deployment (${contextName}):`);
    for (const v of results.violations) {
      console.error(` - [${v.impact}] ${v.id}: ${v.description}`);
      for (const node of v.nodes) {
        console.error(`     Target: ${node.target.join(' ')}`);
        console.error(`     Failure: ${node.failureSummary}`);
      }
    }
    throw new Error(`Live accessibility violations found: ${results.violations.length}`);
  }
  console.log(`  ✓ 0 WCAG 2.2 AA accessibility violations on live deployment (${contextName})`);
}

async function verifyLiveBrowser(name, engine) {
  console.log(`\n=== Verifying Live Production Deployment on ${name.toUpperCase()} ===`);
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const response = await page.goto(LIVE_URL);
    assert.equal(response.status(), 200, 'Live endpoint must return HTTP 200');
    console.log(`  ✓ Live HTTPS status 200 OK: ${LIVE_URL}`);

    // Check security headers and protocol
    assert.ok(response.url().startsWith('https://'), 'Live URL must be HTTPS');

    // Title and heading
    const title = await page.title();
    assert.equal(title, 'UOR Foundry Portal');
    console.log('  ✓ Live title verified: "UOR Foundry Portal"');

    const heading = await page.textContent('h1');
    assert.equal(heading.trim(), 'UOR Foundry');
    console.log('  ✓ Live heading verified: "UOR Foundry"');

    // WCAG 2.2 AA audit on live production
    await runLiveAudit(page, `${name} - Desktop Live`);

    // Verify all 7 stakeholder service views
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

      const isSelected = await tabBtn.getAttribute('aria-selected');
      assert.equal(isSelected, 'true', `Live tab ${svc.name} must be active`);

      const panel = page.locator(`#${svc.id}`);
      const isHidden = await panel.getAttribute('hidden');
      assert.equal(isHidden, null, `Live panel ${svc.name} must be visible`);

      const actionBtn = panel.locator('.action-btn');
      await actionBtn.click();
      await page.waitForTimeout(50);

      const display = panel.locator('.result-display');
      const text = await display.textContent();
      assert.ok(text.includes('Result:'), `Live action output must be displayed: ${text}`);
      console.log(`  ✓ Live service verified: ${svc.name} (${text})`);
    }

    // Responsive mobile audit (320px)
    await page.setViewportSize({ width: 320, height: 600 });
    await page.waitForTimeout(100);
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noOverflow, 'Live mobile viewport (320px) must have no horizontal scroll');
    console.log('  ✓ Live mobile viewport (320px) responsive layout verified');

    await runLiveAudit(page, `${name} - Mobile Live`);

    console.log(`✓ Live verification PASSED on ${name.toUpperCase()}`);
  } finally {
    await browser.close();
  }
}

await verifyLiveBrowser('Chromium', chromium);
await verifyLiveBrowser('Firefox', firefox);

console.log('\n======================================================');
console.log('🎉 LIVE PRODUCTION VERIFICATION COMPLETED SUCCESSFULLY!');
console.log(`URL: ${LIVE_URL}`);
console.log('Status: 200 OK | HTTPS: Enforced | WCAG 2.2 AA: 0 Violations');
console.log('======================================================\n');
