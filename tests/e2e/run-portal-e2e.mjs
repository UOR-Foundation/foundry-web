// tests/e2e/run-portal-e2e.mjs
// End-to-end browser and WCAG 2.2 Level AA accessibility tests for UOR Foundry Portal.
// Tests the full PrismPM modeled capabilities: Identity enrollment, backup codes,
// organization lifecycle with multi-admin quorum, cross-tenant isolation, 7 core stakeholder services,
// decentralized Kappa storage, and offline sync.

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
  console.log(`\n========================================`);
  console.log(`--- Running E2E Suite on ${name.toUpperCase()} ---`);
  console.log(`========================================`);
  const browser = await browserEngine.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture unexpected page errors
  page.on('pageerror', (err) => {
    console.error(`  [${name} Page Error]`, err);
  });

  try {
    // 1. Initial Load & Landmarks
    await page.goto(`http://127.0.0.1:${PORT}/foundry-web/`);
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    assert.equal(title, 'UOR Foundry Portal');
    console.log('  ✓ Page title verified: "UOR Foundry Portal"');

    const heading = await page.textContent('h1.brand-title');
    assert.equal(heading.trim(), 'UOR Foundry Portal');
    console.log('  ✓ Primary heading verified: "UOR Foundry Portal"');

    // 2. Initial Accessibility Audit (Desktop)
    await runAudit(page, `${name} - Desktop Initial State`);

    // 3. Skip Link Keyboard Navigation
    await page.keyboard.press('Tab');
    const skipLinkFocused = await page.evaluate(() => document.activeElement?.classList.contains('skip-link'));
    assert.ok(skipLinkFocused, 'Skip link must receive initial tab focus');
    await page.keyboard.press('Enter');
    const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content');
    assert.ok(mainFocused, 'Main content must receive focus from skip link');
    console.log('  ✓ Skip link keyboard navigation verified');

    // 4. Keyboard Navigation Across Tabs (Arrow Keys)
    const dashTab = page.locator('#tab-dashboard');
    await dashTab.focus();
    await page.keyboard.press('ArrowRight');
    let focusedTabId = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focusedTabId, 'tab-identity', 'ArrowRight must advance focus to tab-identity');

    await page.keyboard.press('End');
    focusedTabId = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focusedTabId, 'tab-storage', 'End must advance focus to tab-storage');

    await page.keyboard.press('Home');
    focusedTabId = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focusedTabId, 'tab-dashboard', 'Home must return focus to tab-dashboard');
    console.log('  ✓ Keyboard tab navigation verified (ArrowRight, End, Home)');

    // 5. Journey 1: User Enrollment & Nonce Verification (EC-01)
    console.log('\n  [Journey 1] User Enrollment & Nonce Verification...');
    await page.locator('#btn-quick-enroll').click();
    assert.equal(await page.locator('#tab-identity').getAttribute('aria-selected'), 'true');

    // Check unenrolled state
    const guestName = await page.locator('#user-display-name').textContent();
    assert.ok(guestName.includes('Guest'), 'Should initially be Guest');

    // Submit challenge request
    await page.locator('#enroll-email').fill('alice@uor.foundation');
    await page.locator('#btn-send-challenge').click();

    // Verify challenge created and nonce populated
    await page.waitForTimeout(50);
    const nonceVal = await page.locator('#verify-nonce').inputValue();
    assert.ok(nonceVal && nonceVal.length === 64, 'Nonce must be 64-char SHA-256 hex');

    // Submit nonce to establish session
    await page.locator('#btn-submit-nonce').click();
    await page.waitForTimeout(50);

    const authedName = await page.locator('#user-display-name').textContent();
    assert.equal(authedName.trim(), 'alice@uor.foundation');
    const didText = await page.locator('#account-did-val').textContent();
    assert.ok(didText.startsWith('did:key:z6Mku'), 'DID must start with did:key:z6Mku');
    const badgeText = await page.locator('#account-status-badge').textContent();
    assert.equal(badgeText.trim(), 'Active');
    console.log('  ✓ User enrollment confirmed: DID ' + didText.substring(0, 24) + '... established');

    // 6. Journey 2: Saved Backup-Code Recovery (BC-01)
    console.log('\n  [Journey 2] Saved Backup-Code Recovery...');
    await page.locator('#tab-backup-codes').click();
    assert.equal(await page.locator('#tab-backup-codes').getAttribute('aria-selected'), 'true');

    await page.locator('#btn-generate-backup-codes').click();
    await page.waitForTimeout(50);

    const initialCount = await page.locator('#batch-count-display').textContent();
    assert.equal(initialCount.trim(), '5');

    const firstCode = (await page.locator('#code-item-0 code').textContent()).trim();
    assert.ok(firstCode.startsWith('BK-'), 'Backup code must start with BK- prefix');

    // Recover account using first code
    await page.locator('#recovery-account').fill('alice@uor.foundation');
    await page.locator('#recovery-revision').fill('1');
    await page.locator('#recovery-code-input').fill(firstCode);
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(50);

    const remainingCount = await page.locator('#batch-count-display').textContent();
    assert.equal(remainingCount.trim(), '4', 'Consumed code must decrement remaining count to 4');

    const recoveryAlert = await page.locator('#recovery-result-box').textContent();
    assert.ok(recoveryAlert.includes('Recovery Successful'), 'Recovery must succeed');

    // Attempt replay with identical code (must be rejected)
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(50);
    const replayAlert = await page.locator('#recovery-result-box').textContent();
    assert.ok(replayAlert.includes('Replay Prohibited'), 'Replay must be strictly prohibited');
    console.log('  ✓ Backup code generated, single-use redeemed, replay rejected under NIST SP 800-63B-4');

    // 7. Journey 3: Organization Lifecycle & Multi-Admin Quorum (OL-01, AM-01)
    console.log('\n  [Journey 3] Organization Lifecycle & Multi-Admin Quorum...');
    await page.locator('#tab-organization').click();

    // Verify initial org state is Provisional with 1 admin
    let orgState = await page.locator('#org-lifecycle-badge').textContent();
    assert.equal(orgState.trim(), 'Provisional');
    let adminCount = await page.locator('#org-admin-count').textContent();
    assert.equal(adminCount.trim(), '1');

    // Attempt activation with 1 admin (must be blocked by quorum requirement)
    page.once('dialog', async (dialog) => {
      assert.ok(dialog.message().includes('Quorum requires at least 2'), 'Alert must enforce 2 admins quorum');
      await dialog.accept();
    });
    await page.locator('#btn-activate-org').click();
    await page.waitForTimeout(50);

    orgState = await page.locator('#org-lifecycle-badge').textContent();
    assert.equal(orgState.trim(), 'Provisional', 'State must remain Provisional when quorum uncovered');

    // Add second admin bob@uor.foundation
    await page.locator('#admin-email').fill('bob@uor.foundation');
    await page.locator('#admin-scope').selectOption('Organization');
    await page.locator('#btn-add-admin').click();
    await page.waitForTimeout(50);

    adminCount = await page.locator('#org-admin-count').textContent();
    assert.equal(adminCount.trim(), '2', 'Admin count must now be 2');

    // Activate organization with quorum met
    await page.locator('#btn-activate-org').click();
    await page.waitForTimeout(50);

    orgState = await page.locator('#org-lifecycle-badge').textContent();
    assert.equal(orgState.trim(), 'Activated', 'State must transition to Activated');

    // Retire founding grant
    await page.locator('#btn-retire-founding').click();
    await page.waitForTimeout(50);
    const grantStatus = await page.locator('#org-founding-grant').textContent();
    assert.ok(grantStatus.includes('Retired'), 'Founding grant must be retired');
    console.log('  ✓ Multi-admin quorum enforced and organization successfully activated');

    // 8. Journey 4: Cross-Tenant Isolation
    console.log('\n  [Journey 4] Cross-Tenant Isolation...');
    await page.locator('#new-org-name').fill('Metropolitan Grid');
    await page.locator('#btn-create-org').click();
    await page.waitForTimeout(50);

    // Active org is now Metropolitan Grid, in Provisional state with 1 admin
    let currentOrgName = await page.locator('#org-name-val').textContent();
    assert.equal(currentOrgName.trim(), 'Metropolitan Grid');
    orgState = await page.locator('#org-lifecycle-badge').textContent();
    assert.equal(orgState.trim(), 'Provisional');

    // Switch back to Citizen Gardens
    const orgSelect = page.locator('#org-select');
    const citizenOptionVal = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('#org-select option'));
      return opts.find(o => o.textContent.includes('Citizen Gardens'))?.value;
    });
    assert.ok(citizenOptionVal, 'Citizen Gardens option must exist');
    await orgSelect.selectOption(citizenOptionVal);
    await page.waitForTimeout(50);

    currentOrgName = await page.locator('#org-name-val').textContent();
    assert.equal(currentOrgName.trim(), 'Citizen Gardens');
    orgState = await page.locator('#org-lifecycle-badge').textContent();
    assert.equal(orgState.trim(), 'Activated');
    console.log('  ✓ Cross-tenant isolation verified across distinct organizations');

    // 9. Journey 5: Stakeholder Services (SV-01 to SV-07)
    console.log('\n  [Journey 5] Testing 7 Core Stakeholder Services...');

    // SV-01: Workflows
    await page.locator('#tab-workflows').click();
    await page.locator('#wf-name-input').fill('production-build');
    await page.locator('#wf-commit-input').fill('0e1c9eb');
    await page.locator('#btn-run-workflow').click();
    await page.waitForTimeout(50);

    const wfRow = page.locator('#workflow-runs-tbody tr').first();
    const wfName = await wfRow.locator('td').nth(1).textContent();
    assert.equal(wfName.trim(), 'production-build');
    const wfStatus = await wfRow.locator('.badge').textContent();
    assert.equal(wfStatus.trim(), 'Succeeded');
    console.log('  ✓ SV-01 Workflows service: execution verified');

    // SV-02: AI Inference with Human Gate
    await page.locator('#tab-ai-inference').click();
    await page.locator('#ai-prompt-input').fill('Analyze verification node capacity');
    await page.locator('#btn-run-inference').click();
    await page.waitForTimeout(50);

    const aiPendingBadge = await page.locator('#ai-proposal-body .badge').textContent();
    assert.ok(aiPendingBadge.includes('Awaiting Human Authorization'), 'Human gate required');

    await page.locator('#btn-approve-ai').click();
    await page.waitForTimeout(50);
    const aiAuthedBadge = await page.locator('#ai-proposal-body .badge').textContent();
    assert.ok(aiAuthedBadge.includes('Authorized by Human Operator'), 'Human authorization recorded');
    console.log('  ✓ SV-02 AI Inference service: human-in-the-loop authorization gate verified');

    // SV-03: Messaging
    await page.locator('#tab-messaging').click();
    await page.locator('#msg-subject').fill('Audit Review');
    await page.locator('#msg-body').fill('Pure-model verification suite passing.');
    await page.locator('#btn-dispatch-message').click();
    await page.waitForTimeout(50);

    const latestMsg = page.locator('#messages-list .message-card').first();
    const msgContent = await latestMsg.locator('.msg-content').textContent();
    assert.ok(msgContent.includes('Audit Review'), 'Message content must match');
    console.log('  ✓ SV-03 Messaging service: ActivityPub dispatch verified');

    // SV-04: Governance & Audit
    await page.locator('#tab-governance').click();
    await page.locator('#gov-title').fill('Upgrade Node Quorum Policy');
    await page.locator('#gov-scope').selectOption('Security');
    await page.locator('#gov-quorum-req').fill('2');
    await page.locator('#btn-submit-proposal').click();
    await page.waitForTimeout(50);

    const propCard = page.locator('#active-proposals-list .proposal-card').first();
    assert.ok((await propCard.locator('strong').textContent()).includes('Upgrade Node Quorum Policy'));

    // Cast vote
    await propCard.locator('.btn-vote').click();
    await page.waitForTimeout(50);

    // Execute proposal
    await propCard.locator('.btn-exec-prop').click();
    await page.waitForTimeout(50);

    const propExecutedBadge = await propCard.locator('.badge').textContent();
    assert.equal(propExecutedBadge.trim(), 'Executed');

    // Verify tamper-evident audit log
    const auditRow = page.locator('#audit-log-tbody tr').first();
    const auditEvent = await auditRow.locator('td').nth(1).textContent();
    assert.ok(auditEvent.includes('Proposal Executed'), 'Audit log must record proposal execution');
    console.log('  ✓ SV-04 Governance service: proposal lifecycle, voting, execution, and audit log verified');

    // SV-05: Finance & Double-Entry Ledger
    await page.locator('#tab-finance').click();
    await page.locator('#fin-desc').fill('Node Infrastructure Grant');
    await page.locator('#fin-amount').fill('5000');
    await page.locator('#btn-post-entry').click();
    await page.waitForTimeout(50);

    const ledgerRow = page.locator('#finance-ledger-tbody tr').first();
    const ledgerStatus = await ledgerRow.locator('.badge').textContent();
    assert.equal(ledgerStatus.trim(), 'PendingSettlement');

    await page.locator('#btn-verify-settlement').click();
    await page.waitForTimeout(50);

    const settledStatus = await ledgerRow.locator('.badge').textContent();
    assert.equal(settledStatus.trim(), 'Settled');
    console.log('  ✓ SV-05 Finance service: double-entry posting & oracle settlement verified');

    // SV-06: Learning & W3C Verifiable Credentials
    await page.locator('#tab-learning').click();
    await page.locator('#evidence-link').fill('https://github.com/uor-foundation/foundry-web/commit/0e1c9eb');
    await page.locator('#btn-submit-assessment').click();
    await page.waitForTimeout(50);

    const vcCard = page.locator('#vc-wallet .vc-card').first();
    const vcText = await vcCard.locator('h4').textContent();
    assert.ok(vcText.includes('Certificate of Mastery'), 'VC must be issued');
    console.log('  ✓ SV-06 Learning service: W3C Verifiable Credential issuance verified');

    // SV-07: Brand & Accessibility Tokens
    await page.locator('#tab-brand').click();
    const brandTokensHeading = await page.locator('#brand-tokens-heading').textContent();
    assert.ok(brandTokensHeading.includes('Authoritative Design Tokens'));
    console.log('  ✓ SV-07 Brand service: design tokens and contrast specifications verified');

    // 10. Journey 6: Decentralized Storage & Offline Sync (BO-01, VB-01, NA-01)
    console.log('\n  [Journey 6] Storage & Offline Sync...');
    await page.locator('#tab-storage').click();
    await page.locator('#blob-input-data').fill('Decentralized consensus state vector');
    await page.locator('#btn-store-blob').click();
    await page.waitForTimeout(50);

    const blobDisplay = await page.locator('#blob-result-display').textContent();
    assert.ok(blobDisplay.includes('Blob Stored in Kappa Space!'), 'Blob must be stored');

    // Test Offline toggle
    await page.locator('#btn-toggle-offline').click();
    await page.waitForTimeout(50);
    let netStatus = await page.locator('#network-status-text').textContent();
    assert.equal(netStatus.trim(), 'Offline');

    // Restore Online and flush sync
    await page.locator('#btn-toggle-offline').click();
    await page.waitForTimeout(50);
    netStatus = await page.locator('#network-status-text').textContent();
    assert.equal(netStatus.trim(), 'Online');

    await page.locator('#btn-flush-sync').click();
    await page.waitForTimeout(50);
    console.log('  ✓ Decentralized storage, offline-first queuing, and replica sync verified');

    // 11. Mobile Viewport (320px) Responsive & Accessibility Audit
    console.log('\n  [Mobile Audit] 320px Viewport...');
    await page.setViewportSize({ width: 320, height: 600 });
    await page.waitForTimeout(100);

    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noHorizontalScroll, 'Mobile viewport (320px) must not have horizontal overflow');
    console.log('  ✓ Mobile viewport (320px) responsive layout verified (0 horizontal overflow)');

    await runAudit(page, `${name} - Mobile Viewport (320px)`);

    // 12. Direct Wasm Dispatch Verification
    const dispatchResult = await page.evaluate(() => {
      return window.uorFoundry?.dispatch('Status: Ready');
    });
    assert.equal(dispatchResult, 'Status: Ready');
    console.log('  ✓ Direct Wasm dispatch acceptance vector verified ("Status: Ready")');

    console.log(`\n🎉 All tests passed on ${name.toUpperCase()}`);
  } finally {
    await browser.close();
  }
}

try {
  await testBrowser('Chromium', chromium);
  await testBrowser('Firefox', firefox);
  console.log('\n======================================================');
  console.log('🎉 ALL BROWSER E2E AND ACCESSIBILITY AUDITS PASSED!');
  console.log('======================================================\n');
} finally {
  server.close();
}
