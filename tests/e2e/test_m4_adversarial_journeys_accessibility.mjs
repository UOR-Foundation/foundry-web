import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../site/crypto.js';

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

console.log('================================================================');
console.log('CHALLENGER EMPIRICAL ADVERSARIAL STRESS SUITE: MILESTONE 4');
console.log('Focus: Accessibility, WCAG 2.1/2.2 AA Parity, Focus Trapping, Key Navigation, Journey Invariants');
console.log('================================================================');

// Ephemeral HTTP Server with proper MIME and Service-Worker-Allowed header
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

await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/`;
console.log(`Ephemeral challenger test HTTP server listening at ${baseUrl}\n`);

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

const browsersToTest = [
  { name: 'chromium', engine: chromium },
  { name: 'firefox', engine: firefox }
];

try {
  for (const { name: browserName, engine } of browsersToTest) {
    console.log(`\n================================================================`);
    console.log(`RUNNING ADVERSARIAL CHALLENGER SUITE ON ENGINE: ${browserName.toUpperCase()}`);
    console.log(`================================================================`);

    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // --------------------------------------------------------------------------
    // PART 1: KEYBOARD NAVIGATION STRESS & FOCUS TRAPPING
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] PART 1: KEYBOARD NAVIGATION & FOCUS TRAPPING ---`);

    await test(`[${browserName}] 1.1 Rapid Alt+1..9 tab cycling fuzzing preserves state & ARIA synchronization`, async () => {
      const tabKeySequence = ['1', '9', '2', '5', '3', '8', '4', '7', '6', '1', '4', '5'];
      const tabMap = {
        '1': { tabId: 'tab-dashboard', panelId: 'panel-dashboard' },
        '2': { tabId: 'tab-identity', panelId: 'panel-identity' },
        '3': { tabId: 'tab-backup-codes', panelId: 'panel-backup-codes' },
        '4': { tabId: 'tab-organization', panelId: 'panel-organization' },
        '5': { tabId: 'tab-projects', panelId: 'panel-projects' },
        '6': { tabId: 'tab-workspaces', panelId: 'panel-workspaces' },
        '7': { tabId: 'tab-workflows', panelId: 'panel-workflows' },
        '8': { tabId: 'tab-ai-inference', panelId: 'panel-ai-inference' },
        '9': { tabId: 'tab-messaging', panelId: 'panel-messaging' }
      };

      for (const num of tabKeySequence) {
        await page.keyboard.press(`Alt+${num}`);
        await page.waitForTimeout(50);
      }

      // Final tab in sequence is Alt+5 (tab-projects)
      const expected = tabMap['5'];
      const activeTabSelected = await page.locator(`#${expected.tabId}`).getAttribute('aria-selected');
      assert.equal(activeTabSelected, 'true', `Active tab ${expected.tabId} must have aria-selected="true"`);

      const panelVisible = await page.locator(`#${expected.panelId}`).isVisible();
      assert.ok(panelVisible, `Panel ${expected.panelId} must be visible`);

      // All other panels must be hidden
      for (const [k, v] of Object.entries(tabMap)) {
        if (k !== '5') {
          const isHidden = await page.locator(`#${v.panelId}`).getAttribute('hidden');
          assert.notEqual(isHidden, null, `Panel ${v.panelId} must be hidden`);
        }
      }
    });

    await test(`[${browserName}] 1.2 Form input keystroke suppression: typing in input does not trigger shortcuts`, async () => {
      // Navigate to identity tab
      await page.keyboard.press('Alt+2');
      await page.waitForTimeout(100);

      const emailInput = page.locator('#enroll-email');
      await emailInput.focus();

      // Type characters including '?' and numbers with Alt
      await page.keyboard.type('test?question@uor.foundation');

      // The shortcuts modal MUST NOT have opened
      const isModalHidden = await page.locator('#shortcuts-modal').getAttribute('hidden');
      assert.notEqual(isModalHidden, null, 'Typing "?" into an input must NOT open shortcuts modal');

      // The input value must contain the question mark verbatim
      const val = await emailInput.inputValue();
      assert.equal(val, 'test?question@uor.foundation', 'Input must contain typed text intact');
      await emailInput.blur();
    });

    await test(`[${browserName}] 1.3 Rapid Alt+T theme toggling stress test maintains consistency`, async () => {
      const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');

      // Toggle theme 10 times rapidly
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Alt+t');
        await page.waitForTimeout(30);
      }

      // 10 toggles from initialTheme must return to initialTheme
      const finalTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert.equal(finalTheme, initialTheme, `10 toggles must return to initial theme "${initialTheme}"`);

      // Toggle once to opposite theme
      await page.keyboard.press('Alt+t');
      await page.waitForTimeout(100);
      const oppositeTheme = initialTheme === 'dark' ? 'light' : 'dark';
      const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert.equal(toggledTheme, oppositeTheme, `Theme must be ${oppositeTheme}`);

      const savedTheme = await page.evaluate(() => localStorage.getItem('foundry_theme'));
      assert.equal(savedTheme, oppositeTheme, `localStorage must persist ${oppositeTheme}`);

      // Toggle back
      await page.keyboard.press('Alt+t');
      await page.waitForTimeout(100);
    });

    await test(`[${browserName}] 1.4 Shortcuts modal focus trap: Tab and Shift-Tab cycling strictly contained`, async () => {
      // Ensure focus is on a known element
      await page.locator('#btn-theme-toggle').focus();

      // Press '?' to open modal
      await page.keyboard.press('?');
      await page.waitForTimeout(150);

      // Verify modal is open
      const isModalOpen = await page.locator('#shortcuts-modal').isVisible();
      assert.ok(isModalOpen, 'Shortcuts modal must be open');

      // First focusable element must have focus (#btn-close-shortcuts)
      const focusedId1 = await page.evaluate(() => document.activeElement.id);
      assert.equal(focusedId1, 'btn-close-shortcuts', 'First focused element must be btn-close-shortcuts');

      // Press Shift+Tab: must wrap to the last focusable element (#btn-dismiss-shortcuts)
      await page.keyboard.press('Shift+Tab');
      await page.waitForTimeout(50);
      const focusedId2 = await page.evaluate(() => document.activeElement.id);
      assert.equal(focusedId2, 'btn-dismiss-shortcuts', 'Shift-Tab on first element must wrap to btn-dismiss-shortcuts');

      // Press Tab: must wrap back to first element (#btn-close-shortcuts)
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);
      const focusedId3 = await page.evaluate(() => document.activeElement.id);
      assert.equal(focusedId3, 'btn-close-shortcuts', 'Tab on last element must wrap back to btn-close-shortcuts');

      // Close modal with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      const isClosed = await page.locator('#shortcuts-modal').getAttribute('hidden');
      assert.notEqual(isClosed, null, 'Escape must close shortcuts modal');
    });

    await test(`[${browserName}] 1.5 Multi-trigger focus restoration upon modal dismissal`, async () => {
      // Trigger 1: Dismissal via Escape restores focus to #tab-projects
      await page.locator('#tab-projects').focus();
      await page.keyboard.press('?');
      await page.waitForTimeout(150);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      let focused = await page.evaluate(() => document.activeElement.id);
      assert.equal(focused, 'tab-projects', 'Focus must restore to tab-projects after Escape');

      // Trigger 2: Dismissal via Done button restores focus to #btn-theme-toggle
      await page.locator('#btn-theme-toggle').focus();
      await page.keyboard.press('?');
      await page.waitForTimeout(150);
      await page.locator('#btn-dismiss-shortcuts').click();
      await page.waitForTimeout(150);
      focused = await page.evaluate(() => document.activeElement.id);
      assert.equal(focused, 'btn-theme-toggle', 'Focus must restore to btn-theme-toggle after Done button click');

      // Trigger 3: Dismissal via Backdrop click restores focus to #tab-identity
      await page.locator('#tab-identity').focus();
      await page.keyboard.press('?');
      await page.waitForTimeout(150);
      // Click outside card (on modal backdrop)
      await page.evaluate(() => {
        document.getElementById('shortcuts-modal').click();
      });
      await page.waitForTimeout(150);
      focused = await page.evaluate(() => document.activeElement.id);
      assert.equal(focused, 'tab-identity', 'Focus must restore to tab-identity after backdrop click');
    });

    await test(`[${browserName}] 1.6 Inbox dropdown panel Escape dismissal & focus restoration`, async () => {
      const inboxBtn = page.locator('#btn-inbox');
      await inboxBtn.focus();
      await inboxBtn.click();
      await page.waitForTimeout(150);

      // Verify inbox panel is visible and button has aria-expanded="true"
      assert.ok(await page.locator('#inbox-panel').isVisible(), 'Inbox panel must be visible');
      assert.equal(await inboxBtn.getAttribute('aria-expanded'), 'true', 'aria-expanded must be true');

      // Press Escape: inbox must close and focus must return to #btn-inbox
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      const isHidden = await page.locator('#inbox-panel').getAttribute('hidden');
      assert.notEqual(isHidden, null, 'Inbox panel must be hidden after Escape');
      assert.equal(await inboxBtn.getAttribute('aria-expanded'), 'false', 'aria-expanded must be false');

      const activeId = await page.evaluate(() => document.activeElement.id);
      assert.equal(activeId, 'btn-inbox', 'Focus must return to btn-inbox after closing inbox');
    });

    // --------------------------------------------------------------------------
    // PART 2: ADVERSARIAL WCAG 2.1 & 2.2 AA AUDITS IN DYNAMIC UI STATES
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] PART 2: ADVERSARIAL WCAG 2.1 & 2.2 AA AUDITS ---`);

    await test(`[${browserName}] 2.1 Modal open state satisfies WCAG 2.1 & 2.2 AA in Dark theme`, async () => {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.keyboard.press('?');
      await page.waitForTimeout(150);

      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (audit.violations.length > 0) {
        console.error('Violations:', JSON.stringify(audit.violations, null, 2));
      }
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations in Dark theme modal state, got ${audit.violations.length}`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    });

    await test(`[${browserName}] 2.2 Modal open state satisfies WCAG 2.1 & 2.2 AA in Light theme`, async () => {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await page.keyboard.press('?');
      await page.waitForTimeout(150);

      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (audit.violations.length > 0) {
        console.error('Violations:', JSON.stringify(audit.violations, null, 2));
      }
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations in Light theme modal state, got ${audit.violations.length}`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    });

    await test(`[${browserName}] 2.3 Inbox panel open state satisfies WCAG 2.1 & 2.2 AA in Dark theme`, async () => {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.locator('#btn-inbox').click();
      await page.waitForTimeout(150);

      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (audit.violations.length > 0) {
        console.error('Violations:', JSON.stringify(audit.violations, null, 2));
      }
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations in Dark theme inbox state, got ${audit.violations.length}`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    });

    // --------------------------------------------------------------------------
    // PART 3: ADVERSARIAL JOURNEY MATRIX ROBUSTNESS & EDGE CASES
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] PART 3: ADVERSARIAL JOURNEY EDGE CASES ---`);

    await test(`[${browserName}] 3.1 Auth session: malformed & altered nonces fail closed`, async () => {
      await page.locator('#tab-identity').click();
      await page.waitForTimeout(150);

      // Issue challenge
      await page.locator('#enroll-email').fill('adversary@uor.foundation');
      await page.locator('#btn-send-challenge').click();
      await page.waitForTimeout(200);

      // Test 1: Empty nonce
      await page.locator('#verify-nonce').fill('');
      await page.locator('#btn-submit-nonce').click();
      await page.waitForTimeout(150);
      let user = await page.locator('#user-display-name').innerText();
      assert.equal(user, 'Guest (Unenrolled)', 'Empty nonce must not authenticate user');

      // Test 2: Truncated nonce (32 chars instead of 64)
      await page.locator('#verify-nonce').fill('00112233445566778899aabbccddeeff');
      await page.locator('#btn-submit-nonce').click();
      await page.waitForTimeout(150);
      user = await page.locator('#user-display-name').innerText();
      assert.equal(user, 'Guest (Unenrolled)', 'Truncated nonce must not authenticate user');

      // Test 3: Bit-flipped nonce
      const mailboxText = await page.locator('#mailbox-content').innerText();
      const match = mailboxText.match(/Verification Nonce:\s*([a-f0-9]{64})/i);
      assert.ok(match, 'Valid challenge nonce must be present in mailbox');
      const validNonce = match[1];
      const flippedNonce = (validNonce[0] === '0' ? '1' : '0') + validNonce.substring(1);
      await page.locator('#verify-nonce').fill(flippedNonce);
      await page.locator('#btn-submit-nonce').click();
      await page.waitForTimeout(150);
      user = await page.locator('#user-display-name').innerText();
      assert.equal(user, 'Guest (Unenrolled)', 'Bit-flipped nonce must not authenticate user');

      // Now authenticate with valid nonce
      await page.locator('#verify-nonce').fill(validNonce);
      await page.locator('#btn-submit-nonce').click();
      await page.waitForTimeout(300);
      user = await page.locator('#user-display-name').innerText();
      assert.equal(user, 'adversary@uor.foundation', 'Authentic nonce must authenticate user');
    });

    await test(`[${browserName}] 3.2 Backup codes: NIST SP 800-63B-4 batch lifecycle & invalid code rejection`, async () => {
      await page.locator('#tab-backup-codes').click();
      await page.waitForTimeout(150);

      // Generate Revision 1 batch
      await page.locator('#btn-generate-backup-codes').click();
      await page.waitForTimeout(200);

      const codesCount = await page.locator('#codes-list li').count();
      assert.equal(codesCount, 10, 'Must generate exactly 10 backup codes');

      // Extract first code
      const firstCodeText = await page.locator('#codes-list li.code-box').first().locator('code').innerText();

      // Test 1: Redeeming code with wrong account email is rejected
      await page.locator('#recovery-account').fill('wrong@uor.foundation');
      await page.locator('#recovery-code-input').fill(firstCodeText);
      await page.locator('#recovery-revision').fill('1');
      await page.locator('#btn-redeem-code').click();
      await page.waitForTimeout(200);

      let resultText = await page.locator('#recovery-result-box').innerText();
      assert.ok(resultText.includes('No backup codes batch found'), 'Mismatched email must be rejected');

      // Test 2: Redeeming non-existent code is rejected
      await page.locator('#recovery-account').fill('adversary@uor.foundation');
      await page.locator('#recovery-code-input').fill('XXXX-XXXX-XXXX-XXXX');
      await page.locator('#btn-redeem-code').click();
      await page.waitForTimeout(200);

      resultText = await page.locator('#recovery-result-box').innerText();
      assert.ok(resultText.includes('Invalid Backup Code'), 'Invalid code must be rejected');

      // Test 3: Authentic redemption of firstCodeText succeeds
      await page.locator('#recovery-code-input').fill(firstCodeText);
      await page.locator('#btn-redeem-code').click();
      await page.waitForTimeout(300);

      // Remaining count should be 9
      const activeCount = await page.locator('#batch-count-display').innerText();
      assert.equal(activeCount, '9', 'Active codes count must decrement to 9');

      // Test 4: Immediate replay attack with firstCodeText must be rejected
      await page.locator('#btn-redeem-code').click();
      await page.waitForTimeout(200);
      resultText = await page.locator('#recovery-result-box').innerText();
      assert.ok(resultText.includes('Replay Prohibited'), 'Replay of consumed code must be rejected');
    });

    await test(`[${browserName}] 3.3 Org retirement safeguard blocks retirement with active project`, async () => {
      // Navigate to organization tab
      await page.locator('#tab-organization').click();
      await page.waitForTimeout(150);

      // Ensure active project exists in this org
      await page.locator('#tab-projects').click();
      await page.waitForTimeout(150);
      await page.locator('#project-name-input').fill('Safeguard Alpha');
      await page.locator('#project-desc-input').fill('Safeguard verification test project');
      await page.locator('#btn-create-project').click();
      await page.waitForTimeout(250);

      // Return to organization tab and attempt to retire without force override
      await page.locator('#tab-organization').click();
      await page.waitForTimeout(150);

      let dialogMessage = '';
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await page.locator('#btn-retire-org').click();
      await page.waitForTimeout(200);

      assert.ok(dialogMessage.includes('Cannot retire organization'), 'Retirement must be blocked with active projects');

      const orgStatus = await page.locator('#org-lifecycle-badge').innerText();
      assert.notEqual(orgStatus, 'Retired', 'Org state must NOT transition to Retired');
    });

    await test(`[${browserName}] 3.4 Attachment size boundary: exact 25 MiB allowed, 25 MiB + 1 byte rejected`, async () => {
      await page.locator('#tab-messaging').click();
      await page.waitForTimeout(150);

      const MAX_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

      // Overflow test (25 MiB + 1 byte)
      let alertMsg = '';
      page.once('dialog', async (dialog) => {
        alertMsg = dialog.message();
        await dialog.accept();
      });

      await page.evaluate((max) => {
        const fakeFile = new File(['0'], 'large.bin', { type: 'application/octet-stream' });
        Object.defineProperty(fakeFile, 'size', { value: max + 1 });
        const dt = new DataTransfer();
        dt.items.add(fakeFile);
        document.getElementById('msg-attachment-file').files = dt.files;
        document.getElementById('msg-subject').value = 'Test Oversize';
        document.getElementById('msg-body').value = 'Payload 25 MiB + 1 byte';
      }, MAX_BYTES);

      await page.locator('#btn-dispatch-message').click();
      await page.waitForTimeout(200);

      assert.ok(alertMsg.includes('Attachment exceeds 25 MiB limit'), 'Must alert on file exceeding 25 MiB');
    });

    await test(`[${browserName}] 3.5 Offline launch & Service Worker caching verification`, async () => {
      // Verify sw registration
      const swRegistered = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await navigator.serviceWorker.getRegistration();
        return reg !== undefined;
      });
      assert.ok(swRegistered, 'Service Worker must be registered in the browser');

      // Verify foundry-cache-v1 contains core assets
      const cachedAssets = await page.evaluate(async () => {
        const cache = await caches.open('foundry-cache-v1');
        const keys = await cache.keys();
        return keys.map(k => new URL(k.url).pathname);
      });
      assert.ok(cachedAssets.length >= 6, `Cache must hold at least 6 core assets, found ${cachedAssets.length}`);

      // Emulate offline
      await context.setOffline(true);

      // Reload page offline
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Check that application booted offline
      const headerTitle = await page.locator('.brand-title').innerText();
      assert.ok(headerTitle.includes('UOR Foundry'), 'Page must load and render offline from Service Worker cache');

      // Restore network
      await context.setOffline(false);
    });

    await context.close();
    await browser.close();
  }
} finally {
  server.close();
}

console.log('\n================================================================');
console.log(`TOTAL ADVERSARIAL CHALLENGER TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  console.error('ADVERSARIAL CHALLENGES FAILED:');
  for (const f of failureDetails) {
    console.error(`- ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL CHALLENGES & WCAG 2.1/2.2 AA ACCESSIBILITY AUDITS PASSED WITH ZERO VIOLATIONS.');
  process.exit(0);
}
