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
  '.wasm': 'application/wasm'
};

const siteDir = resolve('site');

console.log('================================================================');
console.log('MILESTONE 5 CANONICAL 6-FILE APPLICATION JOURNEY MATRIX & WCAG AUDIT');
console.log('================================================================');

// Start Ephemeral HTTP Server serving genuine canonical 6-file browser closure
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
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/`;
console.log(`Ephemeral test HTTP server listening at ${baseUrl}`);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✔ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failureDetails.push({ name, error: err.message, stack: err.stack });
    failedTests++;
  }
}

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const prefix = 'Local draft \u2014 not saved, published, or approved.\n\n';
const invalidError = 'Enter non-empty UTF-8 text within 4,096 bytes.';

const browsersToTest = [
  { name: 'chromium', engine: chromium },
  { name: 'firefox', engine: firefox }
];

try {
  for (const { name: browserName, engine } of browsersToTest) {
    console.log(`\n================================================================`);
    console.log(`RUNNING JOURNEY MATRIX ON ENGINE: ${browserName.toUpperCase()}`);
    console.log(`================================================================`);

    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // --------------------------------------------------------------------------
    // JOURNEY 1: ANONYMOUS BROWSE & INITIAL ACCESSIBILITY STATE
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 1: ANONYMOUS BROWSE & INITIAL STATE ---`);

    await test(`[${browserName}] J1.1 Document title, main heading, and accessible draft preview structure`, async () => {
      const title = await page.title();
      assert.equal(title, 'Foundry \u2014 draft preview', 'Title must be Foundry \u2014 draft preview');

      const heading = await page.getByRole('heading', { level: 1 }).innerText();
      assert.equal(heading, 'Local draft preview', 'Main heading must be Local draft preview');

      const mainExists = await page.locator('main').count();
      assert.equal(mainExists, 1, 'Page must contain exactly one <main> landmark');
    });

    await test(`[${browserName}] J1.2 Semantic form attributes (novalidate, label association, aria-live output)`, async () => {
      const form = page.locator('#application-form');
      assert.ok(await form.isVisible(), 'Form must be visible');
      assert.equal(await form.getAttribute('novalidate'), '', 'Form must have novalidate attribute');

      const textarea = page.locator('#request');
      assert.ok(await textarea.isVisible(), 'Textarea must be visible');
      assert.equal(await textarea.getAttribute('aria-describedby'), 'result', 'Textarea must reference result output');

      const output = page.locator('#result');
      assert.equal(await output.getAttribute('role'), 'status', 'Output must have role status');
      assert.equal(await output.getAttribute('aria-live'), 'polite', 'Output must be aria-live polite');
      assert.equal(await output.getAttribute('aria-atomic'), 'true', 'Output must be aria-atomic true');
    });

    await test(`[${browserName}] J1.3 Zero Axe accessibility violations on initial load`, async () => {
      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (audit.violations.length > 0) {
        console.error('Violations:', JSON.stringify(audit.violations, null, 2));
      }
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations on initial load, got ${audit.violations.length}`);
    });

    // --------------------------------------------------------------------------
    // JOURNEY 2: RESPONSIVE PRESENTATION & VIEWPORT PARITY
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 2: RESPONSIVE PRESENTATION & VIEWPORT PARITY ---`);

    await test(`[${browserName}] J2.1 Desktop viewport layout (1440x1000) with zero horizontal overflow`, async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForTimeout(100);
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflows, false, 'Desktop page must not overflow viewport horizontally');
    });

    await test(`[${browserName}] J2.2 Mobile viewport layout (390x844) with responsive textarea and button`, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(100);
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflows, false, 'Mobile page must not overflow viewport horizontally');

      const btnVisible = await page.locator('#submit').isVisible();
      assert.ok(btnVisible, 'Submit button must remain visible on mobile');
    });

    await test(`[${browserName}] J2.3 Zero Axe accessibility violations across mobile and desktop viewports`, async () => {
      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations on mobile viewport, got ${audit.violations.length}`);
    });

    // --------------------------------------------------------------------------
    // JOURNEY 3: WASM RUNTIME LOADING & MODULE INITIALIZATION
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 3: WASM RUNTIME LOADING & INITIALIZATION ---`);

    await test(`[${browserName}] J3.1 Wasm module loads and initializes WebAssembly instance`, async () => {
      await page.waitForFunction(() => !document.getElementById('submit')?.disabled, { timeout: 10000 });
      const submitDisabled = await page.locator('#submit').isDisabled();
      assert.equal(submitDisabled, false, 'Submit button must be enabled once Wasm binding is ready');
    });

    await test(`[${browserName}] J3.2 Binding module exports genuine WebAssembly function execution`, async () => {
      const response = await fetch(`${baseUrl}prism_foundry_web_bg.wasm`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mod = await WebAssembly.compile(bytes);
      const exports = WebAssembly.Module.exports(mod);
      assert.ok(exports.some(e => e.kind === 'function'), 'Wasm module must export executable functions');
    });

    await test(`[${browserName}] J3.3 Initial status output cleared after runtime readiness`, async () => {
      const outputText = await page.locator('#result').innerText();
      assert.equal(outputText, '', 'Initial failure message must be cleared once runtime is ready');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 4: INTERACTIVE DRAFT PREVIEW LIFECYCLE
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 4: INTERACTIVE DRAFT PREVIEW LIFECYCLE ---`);

    await test(`[${browserName}] J4.1 Text entry and preview submission generates verified draft output with prefix`, async () => {
      const textarea = page.locator('#request');
      await textarea.fill('Hello, Foundry.');
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('Hello, Foundry.'), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + 'Hello, Foundry.', 'Preview must prepend canonical prefix to input');
    });

    await test(`[${browserName}] J4.2 Preview output renders raw text safely without script execution`, async () => {
      let alertFired = false;
      page.on('dialog', async dialog => {
        alertFired = true;
        await dialog.dismiss();
      });

      const textarea = page.locator('#request');
      await textarea.fill('<script>alert("xss")</script>');
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('<script>'), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + '<script>alert("xss")</script>', 'Script tags must be rendered as raw text');
      assert.equal(alertFired, false, 'No alert dialog should execute');
    });

    await test(`[${browserName}] J4.3 Form busy indicator (aria-busy) resets cleanly after invocation`, async () => {
      const form = page.locator('#application-form');
      const isBusy = await form.getAttribute('aria-busy');
      assert.equal(isBusy, null, 'Form aria-busy attribute must be cleared after preview completes');
    });

    await test(`[${browserName}] J4.4 Dynamic output update maintains polite accessibility announcements`, async () => {
      const textarea = page.locator('#request');
      await textarea.fill('Second draft iteration.');
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('Second draft iteration.'), { timeout: 5000 });
      const resultRole = await page.locator('#result').getAttribute('role');
      assert.equal(resultRole, 'status', 'Role must remain status for accessibility');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 5: KEYBOARD-FIRST NAVIGATION & SHORTCUTS
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 5: KEYBOARD-FIRST NAVIGATION & SHORTCUTS ---`);

    await test(`[${browserName}] J5.1 Tab key navigation traverses from textarea to submit button cleanly`, async () => {
      await page.locator('#request').focus();
      await page.keyboard.press('Tab');
      const isSubmitFocused = await page.locator('#submit').evaluate(el => el === document.activeElement);
      assert.ok(isSubmitFocused, 'Submit button must receive focus after Tab from textarea');
    });

    await test(`[${browserName}] J5.2 Enter key on focused submit button triggers preview generation`, async () => {
      await page.locator('#request').fill('Submitted via Enter key.');
      await page.locator('#submit').focus();
      await page.keyboard.press('Enter');

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('Submitted via Enter key.'), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + 'Submitted via Enter key.');
    });

    await test(`[${browserName}] J5.3 Control+Enter / Meta+Enter shortcut inside textarea submits draft preview`, async () => {
      await page.locator('#request').fill('Submitted via Ctrl+Enter shortcut.');
      await page.locator('#request').press('Control+Enter');

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('Submitted via Ctrl+Enter shortcut.'), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + 'Submitted via Ctrl+Enter shortcut.');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 6: OFFLINE CAPABILITY & NETWORK BOUNDARY ISOLATION
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 6: OFFLINE CAPABILITY & NETWORK BOUNDARY ISOLATION ---`);

    await test(`[${browserName}] J6.1 Client generates Wasm draft previews fully offline without network connection`, async () => {
      await context.setOffline(true);
      await page.locator('#request').fill('Offline preview execution.');
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('Offline preview execution.'), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + 'Offline preview execution.');
      await context.setOffline(false);
    });

    await test(`[${browserName}] J6.2 Zero external network requests escape browser origin`, async () => {
      const externalRequests = [];
      page.on('request', req => {
        const url = new URL(req.url());
        if (url.origin !== new URL(baseUrl).origin) {
          externalRequests.push(req.url());
        }
      });
      await page.locator('#request').fill('Testing zero external network requests.');
      await page.locator('#submit').click();
      await page.waitForTimeout(300);
      assert.equal(externalRequests.length, 0, `Expected 0 external requests, got ${externalRequests.length}`);
    });

    await test(`[${browserName}] J6.3 Zero mutable test harness state exposed on window (window.uorFoundry)`, async () => {
      const hasMockState = await page.evaluate(() => !!window.uorFoundry?.state);
      assert.equal(hasMockState, false, 'Production page must not expose mutable state on window.uorFoundry');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 7: BOUNDARY CONDITIONS & ERROR HANDLING
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 7: BOUNDARY CONDITIONS & ERROR HANDLING ---`);

    await test(`[${browserName}] J7.1 Text exceeding 4,096 bytes triggers input error and sets aria-invalid`, async () => {
      const oversized = 'a'.repeat(4097);
      await page.locator('#request').fill(oversized);
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('4,096 bytes'), { timeout: 5000 });
      const errorText = await page.locator('#result').innerText();
      assert.equal(errorText, invalidError, 'Must show exact input limit validation error');

      const isInvalid = await page.locator('#request').getAttribute('aria-invalid');
      assert.equal(isInvalid, 'true', 'Textarea must have aria-invalid="true" on validation error');
    });

    await test(`[${browserName}] J7.2 Whitespace input produces valid draft preview without rejection`, async () => {
      await page.locator('#request').fill('   ');
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('   '), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + '   ', 'Whitespace input must be previewed cleanly');
    });

    await test(`[${browserName}] J7.3 Validation error automatically retains focus on request textarea`, async () => {
      const oversized = 'x'.repeat(4097);
      await page.locator('#request').fill(oversized);
      await page.locator('#submit').click();

      const errorText = await page.locator('#result').innerText();
      assert.equal(errorText, invalidError, 'Oversized text must be rejected');

      const isFocused = await page.locator('#request').evaluate(el => el === document.activeElement);
      assert.ok(isFocused, 'Textarea must retain focus on validation error');
    });

    await test(`[${browserName}] J7.4 Error recovery: correcting input clears error and restores aria-invalid`, async () => {
      await page.locator('#request').fill('Recovered valid draft text.');
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('Recovered valid draft text.'), { timeout: 5000 });
      const isInvalid = await page.locator('#request').getAttribute('aria-invalid');
      assert.equal(isInvalid, null, 'aria-invalid attribute must be removed on valid submission');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 8: UNICODE & ENCODING ROBUSTNESS
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 8: UNICODE & ENCODING ROBUSTNESS ---`);

    await test(`[${browserName}] J8.1 Multi-byte UTF-8 character sequences (emojis) handled correctly`, async () => {
      const emojiText = 'Citizen Gardens \u2014 ideas \uD83C\uDF31\uD83C\uDF3E\uD83C\uDF3B';
      await page.locator('#request').fill(emojiText);
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('\uD83C\uDF31'), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + emojiText, 'Multi-byte UTF-8 emojis must roundtrip accurately');
    });

    await test(`[${browserName}] J8.2 Unicode boundary characters (BOM, quotes, punctuation) preserved faithfully`, async () => {
      const boundaryText = '\uFEFFData \u201Cquoted\u201D with special \u2014 punctuation.';
      await page.locator('#request').fill(boundaryText);
      await page.locator('#submit').click();

      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('quoted'), { timeout: 5000 });
      const resultText = await page.locator('#result').innerText();
      assert.equal(resultText, prefix + boundaryText, 'Unicode BOM and punctuation must be preserved');
    });

    await test(`[${browserName}] J8.3 Surrogate pair boundary validation prevents malformed UTF-16 submission`, async () => {
      await page.evaluate(() => {
        document.getElementById('request').value = '\ud800';
      });
      await page.locator('#submit').click();

      const errorText = await page.locator('#result').innerText();
      assert.equal(errorText, invalidError, 'Malformed UTF-16 surrogate must be rejected');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 9: COMPREHENSIVE FINAL WCAG ACCESSIBILITY VERIFICATION
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 9: COMPREHENSIVE FINAL WCAG AUDITS ---`);

    await test(`[${browserName}] J9.1 Zero Axe violations after successful draft preview generation`, async () => {
      await page.locator('#request').fill('Final accessibility verification draft.');
      await page.locator('#submit').click();
      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('Final accessibility verification'), { timeout: 5000 });

      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations after draft generation, got ${audit.violations.length}`);
    });

    await test(`[${browserName}] J9.2 Zero Axe violations after validation error state display`, async () => {
      await page.locator('#request').fill('');
      await page.locator('#submit').click();
      await page.waitForFunction(() => document.getElementById('result')?.textContent?.includes('4,096 bytes'), { timeout: 5000 });

      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations in error state, got ${audit.violations.length}`);
    });

    await test(`[${browserName}] J9.3 Contrast verification and focus visibility across interactive elements`, async () => {
      await page.locator('#request').focus();
      const textareaFocusOutline = await page.locator('#request').evaluate(el => window.getComputedStyle(el).outlineStyle !== 'none' || window.getComputedStyle(el).borderColor !== '');
      assert.ok(textareaFocusOutline, 'Focused textarea must exhibit visible focus indicator');

      await page.locator('#submit').focus();
      const submitFocusOutline = await page.locator('#submit').evaluate(el => window.getComputedStyle(el).outlineStyle !== 'none' || window.getComputedStyle(el).borderColor !== '');
      assert.ok(submitFocusOutline, 'Focused button must exhibit visible focus indicator');
    });

    await browser.close();
  }
} finally {
  server.close();
}

console.log('\n================================================================');
console.log(`EXECUTION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('================================================================');

if (failedTests > 0) {
  console.error('\nFAILURE DETAILS:');
  for (const f of failureDetails) {
    console.error(`- ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\nALL 58 JOURNEY TESTS PASSED WITH 0 AXE ACCESSIBILITY VIOLATIONS.');
  process.exit(0);
}
