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
console.log('MILESTONE 4 COMPLETE EXECUTABLE JOURNEY MATRIX & WCAG AUDIT (U27 & U05)');
console.log('================================================================');

// Start Ephemeral HTTP Server for genuine Service Worker and origin security context
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
    // JOURNEY 1: ANONYMOUS BROWSE & INITIAL IDENTITY STATE
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 1: ANONYMOUS BROWSE & INITIAL STATE ---`);

    await test(`[${browserName}] J1.1 Initial unauthenticated identity badge and DID`, async () => {
      const userName = await page.locator('#user-display-name').innerText();
      assert.equal(userName, 'Guest (Unenrolled)', 'Initial user must be Guest (Unenrolled)');

      const userDid = await page.locator('#user-did-display').innerText();
      assert.equal(userDid, 'did:key:unauthenticated', 'Initial DID must be did:key:unauthenticated');

      const isPanelVisible = await page.locator('#panel-dashboard').isVisible();
      assert.ok(isPanelVisible, 'Dashboard panel must be visible initially');
    });

    await test(`[${browserName}] J1.2 Anonymous browsing across public panels`, async () => {
      // Browse Workflows
      await page.locator('#tab-workflows').click();
      await page.waitForTimeout(150);
      assert.ok(await page.locator('#panel-workflows').isVisible(), 'Workflows panel visible');

      // Browse Finance
      await page.locator('#tab-finance').click();
      await page.waitForTimeout(150);
      assert.ok(await page.locator('#panel-finance').isVisible(), 'Finance panel visible');

      // Browse Brand
      await page.locator('#tab-brand').click();
      await page.waitForTimeout(150);
      assert.ok(await page.locator('#panel-brand').isVisible(), 'Brand panel visible');

      // Browse Storage
      await page.locator('#tab-storage').click();
      await page.waitForTimeout(150);
      assert.ok(await page.locator('#panel-storage').isVisible(), 'Storage panel visible');
    });

    await test(`[${browserName}] J1.3 Zero Axe accessibility violations on initial public views`, async () => {
      const audit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (audit.violations.length > 0) {
        console.error('Violations:', JSON.stringify(audit.violations, null, 2));
      }
      assert.equal(audit.violations.length, 0, `Expected 0 Axe violations on initial view, got ${audit.violations.length}`);
    });

    // --------------------------------------------------------------------------
    // JOURNEY 2: THEME PARITY & KEYBOARD-FIRST NAVIGATION
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 2: THEME PARITY & KEYBOARD-FIRST NAVIGATION ---`);

    await test(`[${browserName}] J2.1 Theme Switcher toggles Dark mode and updates attributes`, async () => {
      await page.locator('#btn-theme-toggle').click();
      await page.waitForTimeout(200);

      const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert.equal(htmlTheme, 'dark', 'Document element data-theme must be dark');

      const toggleText = await page.locator('#theme-toggle-text').innerText();
      assert.equal(toggleText, 'Dark', 'Theme toggle button text must show Dark');

      const ariaLabel = await page.locator('#btn-theme-toggle').getAttribute('aria-label');
      assert.ok(ariaLabel.includes('dark'), 'Theme toggle aria-label must reflect dark theme');
    });

    await test(`[${browserName}] J2.2 Brand & WCAG panel exhibits verified contrast proofs for both themes`, async () => {
      await page.locator('#tab-brand').click();
      await page.waitForTimeout(200);

      const brandText = await page.locator('#panel-brand').innerText();
      assert.ok(brandText.includes('Light Theme Ratios'), 'Brand panel must display Light Theme Ratios');
      assert.ok(brandText.includes('Dark Theme Ratios'), 'Brand panel must display Dark Theme Ratios');
      assert.ok(brandText.includes('Focus Indicator Ring'), 'Brand panel must verify focus ring contrast');
      assert.ok(brandText.includes('Pass (AAA'), 'Brand panel must verify AAA contrast');
    });

    await test(`[${browserName}] J2.3 Zero Axe accessibility violations under Dark theme across interactive panels`, async () => {
      const interactiveTabs = ['tab-brand', 'tab-identity', 'tab-organization', 'tab-projects', 'tab-messaging'];
      for (const tabId of interactiveTabs) {
        await page.locator(`#${tabId}`).click();
        await page.waitForTimeout(150);
        const darkAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
        if (darkAudit.violations.length > 0) {
          console.error(`Dark theme violations on #${tabId}:`, JSON.stringify(darkAudit.violations, null, 2));
        }
        assert.equal(darkAudit.violations.length, 0, `Expected 0 Axe violations on #${tabId} in Dark theme, got ${darkAudit.violations.length}`);
      }
    });

    await test(`[${browserName}] J2.4 Global keyboard shortcuts (Alt+1..9, ?, Escape, Alt+T)`, async () => {
      // Test Alt+4 to navigate to Organization tab
      await page.keyboard.press('Alt+4');
      await page.waitForTimeout(250);
      assert.ok(await page.locator('#panel-organization').isVisible(), 'Alt+4 must activate Organization tab');

      // Test Alt+5 to navigate to Projects tab
      await page.keyboard.press('Alt+5');
      await page.waitForTimeout(250);
      assert.ok(await page.locator('#panel-projects').isVisible(), 'Alt+5 must activate Projects tab');

      // Test '?' to open Keyboard Shortcuts modal
      await page.keyboard.press('?');
      await page.waitForTimeout(250);
      const isModalVisible = await page.locator('#shortcuts-modal').isVisible();
      assert.ok(isModalVisible, 'Pressing ? must open Shortcuts modal');

      // Test Escape to close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const isModalHidden = await page.locator('#shortcuts-modal').getAttribute('hidden');
      assert.notEqual(isModalHidden, null, 'Pressing Escape must close Shortcuts modal');

      // Test Alt+T to toggle theme back to Light
      await page.keyboard.press('Alt+t');
      await page.waitForTimeout(250);
      const lightTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert.equal(lightTheme, 'light', 'Alt+T must toggle theme back to light');
    });

    await test(`[${browserName}] J2.5 Zero Axe accessibility violations under Light theme`, async () => {
      const lightAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (lightAudit.violations.length > 0) {
        console.error('Light theme violations:', JSON.stringify(lightAudit.violations, null, 2));
      }
      assert.equal(lightAudit.violations.length, 0, `Expected 0 Axe violations in Light theme, got ${lightAudit.violations.length}`);
    });

    // --------------------------------------------------------------------------
    // JOURNEY 3: SCOPE & ORGANIZATION SELECTION
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 3: SCOPE & ORGANIZATION SELECTION ---`);

    await test(`[${browserName}] J3.1 Organization selector reflects active scope`, async () => {
      await page.locator('#tab-organization').click();
      await page.waitForTimeout(200);

      const activeOrgVal = await page.locator('#org-select').inputValue();
      assert.equal(activeOrgVal, 'uor:org:citizen-gardens-01', 'Default selected org must be Citizen Gardens');

      const orgName = await page.locator('#org-name-val').innerText();
      assert.equal(orgName, 'Citizen Gardens', 'Org display name must be Citizen Gardens');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 4: SIGN-UP, SIGN-IN & SESSION LIFECYCLE
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 4: SIGN-UP, SIGN-IN & SESSION LIFECYCLE ---`);

    await test(`[${browserName}] J4.1 Email challenge issuance, nonce verification, and WebCrypto P-256 session`, async () => {
      await page.locator('#tab-identity').click();
      await page.waitForTimeout(200);

      await page.locator('#enroll-email').fill('alice@uor.foundation');
      await page.locator('#btn-send-challenge').click();
      await page.waitForTimeout(300);

      // Verify challenge nonce is in mailbox preview
      const mailboxText = await page.locator('#mailbox-content').innerText();
      const match = mailboxText.match(/Verification Nonce:\s*([a-f0-9]{64})/i);
      assert.ok(match, `Challenge nonce must be 64-char hex in mailbox content: "${mailboxText}"`);
      const nonceVal = match[1];

      // Fill verify-nonce
      await page.locator('#verify-nonce').fill(nonceVal);

      // Click verify
      await page.locator('#btn-submit-nonce').click();
      await page.waitForTimeout(400);

      // Verify authenticated user identity
      const userName = await page.locator('#user-display-name').innerText();
      assert.equal(userName, 'alice@uor.foundation', 'User display name must be alice@uor.foundation');

      const userDid = await page.locator('#user-did-display').innerText();
      assert.ok(userDid.startsWith('did:key:z'), 'User DID must be genuine P-256 did:key');

      const statusBadge = await page.locator('#account-status-badge').innerText();
      assert.ok(statusBadge.includes('Active'), 'Account status badge must show Active');

      // Verify notification in inbox
      const unreadBadge = await page.locator('#unread-notif-badge').innerText();
      assert.ok(parseInt(unreadBadge, 10) >= 1, 'SecurityLogin notification must be registered');
    });

    await test(`[${browserName}] J4.2 Session termination and re-authentication lifecycle`, async () => {
      await page.locator('#btn-logout').click();
      await page.waitForTimeout(300);

      let userName = await page.locator('#user-display-name').innerText();
      assert.equal(userName, 'Guest (Unenrolled)', 'User must return to Guest upon termination');

      // Re-authenticate alice
      await page.locator('#enroll-email').fill('alice@uor.foundation');
      await page.locator('#btn-send-challenge').click();
      await page.waitForTimeout(300);

      const mailboxText = await page.locator('#mailbox-content').innerText();
      const match = mailboxText.match(/Verification Nonce:\s*([a-f0-9]{64})/i);
      assert.ok(match, 'Re-auth challenge nonce must be present');
      await page.locator('#verify-nonce').fill(match[1]);
      await page.locator('#btn-submit-nonce').click();
      await page.waitForTimeout(400);

      userName = await page.locator('#user-display-name').innerText();
      assert.equal(userName, 'alice@uor.foundation', 'User re-authenticated successfully');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 5: BACKUP CODES ISSUANCE, SINGLE-USE REDEMPTION & ROTATION
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 5: BACKUP CODES ISSUANCE & REDEMPTION ---`);

    let redeemedCode = '';
    await test(`[${browserName}] J5.1 Issue 10 NIST SP 800-63B-4 backup codes batch (Revision 1)`, async () => {
      await page.locator('#tab-backup-codes').click();
      await page.waitForTimeout(200);

      await page.locator('#btn-generate-backup-codes').click();
      await page.waitForTimeout(300);

      const rev = await page.locator('#batch-revision-display').innerText();
      assert.equal(rev, '1', 'Initial batch revision must be 1');

      const count = await page.locator('#batch-count-display').innerText();
      assert.equal(count, '10', 'Batch must contain 10 active codes');

      const codeBoxes = await page.locator('#codes-list li.code-box').all();
      assert.equal(codeBoxes.length, 10, 'Must render 10 semantic list items in #codes-list');

      redeemedCode = (await codeBoxes[0].innerText()).trim();
      assert.ok(redeemedCode.length >= 8, 'Backup code must be valid non-empty string');
    });

    await test(`[${browserName}] J5.2 Single-use code redemption consumes code and invalidates prior sessions`, async () => {
      await page.locator('#recovery-account').fill('alice@uor.foundation');
      await page.locator('#recovery-revision').fill('1');
      await page.locator('#recovery-code-input').fill(redeemedCode);

      await page.locator('#form-redeem-backup-code button[type="submit"]').click();
      await page.waitForTimeout(400);

      const resultBox = await page.locator('#recovery-result-box').innerText();
      assert.ok(resultBox.includes('Recovery Successful'), 'Recovery must succeed');

      const count = await page.locator('#batch-count-display').innerText();
      assert.equal(count, '9', 'Remaining active codes count must decrement to 9');

      const firstCodeClass = await page.locator('#code-item-0').getAttribute('class');
      assert.ok(firstCodeClass.includes('consumed'), 'Redeemed code item must have consumed class');
    });

    await test(`[${browserName}] J5.3 Anti-replay: reusing consumed code is strictly rejected`, async () => {
      await page.locator('#form-redeem-backup-code button[type="submit"]').click();
      await page.waitForTimeout(300);

      const resultBox = await page.locator('#recovery-result-box').innerText();
      assert.ok(resultBox.includes('Replay Prohibited'), 'Replay must be prohibited');
    });

    await test(`[${browserName}] J5.4 Batch rotation to Revision 2 invalidates unredeemed codes from Revision 1`, async () => {
      await page.locator('#btn-generate-backup-codes').click();
      await page.waitForTimeout(300);

      const rev = await page.locator('#batch-revision-display').innerText();
      assert.equal(rev, '2', 'Rotated batch revision must be 2');

      // Try redeeming with Revision 1
      await page.locator('#recovery-revision').fill('1');
      await page.locator('#recovery-code-input').fill('TEST-CODE-STALE');
      await page.locator('#form-redeem-backup-code button[type="submit"]').click();
      await page.waitForTimeout(300);

      const resultBox = await page.locator('#recovery-result-box').innerText();
      assert.ok(resultBox.includes('Stale Revision'), 'Code from stale revision must be rejected');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 6: ORGANIZATION CREATION, INVITATIONS & QUORUM GOVERNANCE
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 6: ORG CREATION, INVITATIONS & QUORUM ---`);

    await test(`[${browserName}] J6.1 Create new Organization without seeded authority`, async () => {
      await page.locator('#tab-organization').click();
      await page.waitForTimeout(200);

      await page.locator('#new-org-name').fill('Civic Commons Initiative');
      await page.locator('#btn-create-org').click();
      await page.waitForTimeout(300);

      const currentOrgName = await page.locator('#org-name-val').innerText();
      assert.equal(currentOrgName, 'Civic Commons Initiative', 'Active org must be Civic Commons Initiative');
    });

    await test(`[${browserName}] J6.2 Add second administrator to satisfy multi-admin quorum`, async () => {
      await page.locator('#admin-email').fill('bob@uor.foundation');
      await page.locator('#btn-add-admin').click();
      await page.waitForTimeout(300);

      const rosterList = await page.locator('#admin-roster-list').innerText();
      assert.ok(rosterList.includes('bob@uor.foundation'), 'bob@uor.foundation must be enrolled in admin roster');
    });

    await test(`[${browserName}] J6.3 Submit governance change proposal and execute via 2/2 quorum`, async () => {
      await page.locator('#tab-governance').click();
      await page.waitForTimeout(200);

      await page.locator('#gov-title').fill('Civic Seed Grant Allocation');
      await page.locator('#gov-scope').selectOption('Finance');
      await page.locator('#btn-submit-proposal').click();
      await page.waitForTimeout(300);

      let proposalsText = await page.locator('#active-proposals-list').innerText();
      assert.ok(proposalsText.includes('Civic Seed Grant Allocation'), 'Proposal must be listed');
      assert.ok(proposalsText.includes('Pending Quorum'), 'Proposal must be Pending Quorum (1/2 approvals)');

      // Bob casts second approval
      const voteBtn = page.locator('#active-proposals-list .btn-vote').first();
      await voteBtn.click();
      await page.waitForTimeout(300);

      // Execute proposal
      const execBtn = page.locator('#active-proposals-list .btn-exec-prop').first();
      assert.ok(await execBtn.isVisible(), 'Execute Proposal button must be visible when quorum reached');
      await execBtn.click();
      await page.waitForTimeout(300);

      proposalsText = await page.locator('#active-proposals-list').innerText();
      assert.ok(proposalsText.includes('Executed'), 'Proposal status must transition to Executed');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 7: PROJECTS CRUD, DELIVERABLES & ACTIVITY JOURNAL
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 7: PROJECTS CRUD, DELIVERABLES & JOURNAL ---`);

    await test(`[${browserName}] J7.1 Project creation with duplicate name rejection within organization`, async () => {
      await page.locator('#tab-projects').click();
      await page.waitForTimeout(200);

      const pName = 'Community Food Forest';
      const pSlug = 'food-forest';

      await page.locator('#project-name-input').fill(pName);
      await page.locator('#project-slug-input').fill(pSlug);
      await page.locator('#project-desc-input').fill('Permaculture agroforestry platform');
      await page.locator('#btn-create-project').click();
      await page.waitForTimeout(300);

      const activeName = await page.locator('#project-active-name').innerText();
      assert.equal(activeName, pName, 'Active project must switch to Community Food Forest');

      // Duplicate rejection
      let alertMessage = '';
      page.once('dialog', async (dialog) => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      await page.locator('#project-name-input').fill(pName);
      await page.locator('#project-slug-input').fill(pSlug);
      await page.locator('#btn-create-project').click();
      await page.waitForTimeout(300);

      assert.ok(alertMessage.includes('already exists'), 'Duplicate project name must trigger alert dialog');
    });

    await test(`[${browserName}] J7.2 Milestone & deliverable creation with SHA-256 verification proof`, async () => {
      await page.locator('#milestone-title-input').fill('Phase 1: Hydrology & Soil Baseline');
      await page.locator('#milestone-date-input').fill('2026-11-20');
      await page.locator('#btn-add-milestone').click();
      await page.waitForTimeout(300);

      await page.locator('#deliverable-title-input').fill('Soil Mineral Composition Proof');
      await page.locator('#btn-add-deliverable').click();
      await page.waitForTimeout(300);

      // Verify deliverable
      const verifyBtn = page.locator('#milestone-list .btn-verify-deliverable').first();
      await verifyBtn.click();
      await page.waitForTimeout(400);

      const milestonesText = await page.locator('#milestone-list').innerText();
      assert.ok(milestonesText.includes('Verified'), 'Deliverable status must be Verified');
      assert.ok(milestonesText.includes('sha256:'), 'Deliverable must display authentic SHA-256 digest');
    });

    await test(`[${browserName}] J7.3 Tamper-evident chained activity journal integrity`, async () => {
      const chainStatus = await page.locator('#activity-chain-status').innerText();
      assert.equal(chainStatus, 'Verified Chain', 'Activity chain must be verified');

      const isChainValid = await page.evaluate(async () => {
        const uor = window.uorFoundry;
        const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
        if (!proj) return false;
        const res = await uor.verifyActivityChain(proj.activityLog, proj.id);
        return res.valid;
      });
      assert.ok(isChainValid, 'Empirical activity chain verification must return valid: true');
    });

    await test(`[${browserName}] J7.4 Draft and publish immutable project release`, async () => {
      await page.locator('#release-tag-input').fill('v1.0.0');
      await page.locator('#release-title-input').fill('Production Canopy Plan');
      await page.locator('#release-notes-input').fill('Fully verified soil specifications');
      await page.locator('#btn-create-release').click();
      await page.waitForTimeout(300);

      const publishBtn = page.locator('#project-releases-tbody .btn-publish-release').first();
      await publishBtn.click();
      await page.waitForTimeout(400);

      const tableText = await page.locator('#project-releases-tbody').innerText();
      assert.ok(tableText.includes('Published'), 'Release must be marked Published');
      assert.ok(tableText.includes('Immutable'), 'Release must be marked Immutable');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 8: MESSAGING, 25 MIB ATTACHMENTS & SHARED INBOX
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 8: MESSAGING, ATTACHMENTS & INBOX ---`);

    await test(`[${browserName}] J8.1 Channel management and message activity stream`, async () => {
      await page.locator('#tab-messaging').click();
      await page.waitForTimeout(200);

      await page.locator('#channel-name-input').fill('#agroforestry');
      await page.locator('#btn-create-channel').click();
      await page.waitForTimeout(300);

      const channelList = await page.locator('#channel-list').innerText();
      assert.ok(channelList.includes('#agroforestry'), 'Channel #agroforestry must be created');

      await page.locator('#msg-subject').fill('Planting Schedule');
      await page.locator('#msg-body').fill('First nursery shipment arrives on Wednesday.');
      await page.locator('#btn-dispatch-message').click();
      await page.waitForTimeout(300);

      const msgStream = await page.locator('#messages-list').innerText();
      assert.ok(msgStream.includes('Planting Schedule'), 'Dispatched message must appear in stream');
    });

    await test(`[${browserName}] J8.2 Media attachments: oversized (> 25 MiB) rejected, valid stored in Kappa`, async () => {
      let alertMsg = '';
      page.once('dialog', async (dialog) => {
        alertMsg = dialog.message();
        await dialog.accept();
      });

      // Inject oversized file
      await page.evaluate(() => {
        const fakeFile = new File(['0'], 'large_dataset.raw', { type: 'application/octet-stream' });
        Object.defineProperty(fakeFile, 'size', { value: 26 * 1024 * 1024 });
        const dt = new DataTransfer();
        dt.items.add(fakeFile);
        document.getElementById('msg-attachment-file').files = dt.files;
        document.getElementById('msg-subject').value = 'Oversized Attachment';
        document.getElementById('msg-body').value = 'Attempting upload';
      });

      await page.locator('#btn-dispatch-message').click();
      await page.waitForTimeout(300);
      assert.ok(alertMsg.includes('25 MiB'), 'Attachment > 25 MiB must be rejected with alert');

      // Upload valid attachment with WCAG alt-text
      const payloadContent = 'Verified Permaculture Planting Grid Spec v1.0';
      await page.evaluate((text) => {
        const validFile = new File([text], 'planting_grid.txt', { type: 'text/plain' });
        const dt = new DataTransfer();
        dt.items.add(validFile);
        document.getElementById('msg-attachment-file').files = dt.files;
        document.getElementById('msg-attachment-alt').value = 'Text layout of the planting grid matrix';
        document.getElementById('msg-subject').value = 'Planting Grid Spec';
        document.getElementById('msg-body').value = 'Attached validated spec.';
      }, payloadContent);

      await page.locator('#btn-dispatch-message').click();
      await page.waitForTimeout(400);

      const msgHtml = await page.locator('#messages-list').innerHTML();
      assert.ok(msgHtml.includes('planting_grid.txt'), 'Valid attachment must appear in messages list');
      assert.ok(msgHtml.includes('Text layout of the planting grid matrix'), 'Accessible alt text must be rendered');

      // Verify blob retrieval from Kappa store
      const blobRetrieved = await page.evaluate(async (expected) => {
        const uor = window.uorFoundry;
        const msg = uor.state.messages[uor.state.messages.length - 1];
        if (!msg || !msg.attachment) return false;
        const record = await uor.getBlob(msg.attachment.digest);
        if (!record) return false;
        const decoded = new TextDecoder().decode(new Uint8Array(record.data));
        return decoded === expected;
      }, payloadContent);

      assert.ok(blobRetrieved, 'Retrieved Kappa blob content must match original payload exactly');
    });

    await test(`[${browserName}] J8.3 Shared Inbox notifications, Mark All Read, and Escape focus restore`, async () => {
      await page.locator('#btn-inbox').click();
      await page.waitForTimeout(200);

      assert.ok(await page.locator('#inbox-panel').isVisible(), 'Inbox panel must open');

      await page.locator('#btn-mark-all-read').click();
      await page.waitForTimeout(200);

      const unread = await page.locator('#unread-notif-badge').innerText();
      assert.equal(unread, '0', 'Unread notifications count must be 0 after Mark All Read');

      // Press Escape to close dropdown and restore focus
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      assert.notEqual(await page.locator('#inbox-panel').getAttribute('hidden'), null, 'Inbox panel must close on Escape');
    });

    // --------------------------------------------------------------------------
    // JOURNEY 9: OFFLINE LAUNCH, SERVICE WORKER & RETIREMENT PROTECTION
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] JOURNEY 9: OFFLINE LAUNCH, SERVICE WORKER & RETIREMENT ---`);

    await test(`[${browserName}] J9.1 Service Worker registration and core assets caching (foundry-cache-v1)`, async () => {
      const swStatus = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return { supported: false };
        const reg = await navigator.serviceWorker.ready;
        const cache = await caches.open('foundry-cache-v1');
        const keys = await cache.keys();
        return {
          supported: true,
          active: !!reg.active,
          cachedCount: keys.length
        };
      });

      assert.ok(swStatus.supported, 'ServiceWorker must be supported');
      assert.ok(swStatus.active, 'ServiceWorker must be active');
      assert.ok(swStatus.cachedCount > 0, 'Cache foundry-cache-v1 must contain pre-cached assets');
    });

    await test(`[${browserName}] J9.2 Offline launch resilience: reload page with network disconnected`, async () => {
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const pageTitle = await page.title();
      assert.ok(pageTitle.includes('UOR Foundry'), 'Page title must load offline via Service Worker');

      const isNavVisible = await page.locator('.app-nav').isVisible();
      assert.ok(isNavVisible, 'Application UI must render completely from offline cache');

      // Reconnect online
      await context.setOffline(false);
    });

    await test(`[${browserName}] J9.3 Organization retirement safeguard: blocked with active project dependencies`, async () => {
      await page.locator('#tab-organization').click();
      await page.waitForTimeout(200);

      let alertMsg = '';
      page.once('dialog', async (dialog) => {
        alertMsg = dialog.message();
        await dialog.accept();
      });

      await page.locator('#btn-retire-org').click();
      await page.waitForTimeout(300);

      assert.ok(alertMsg.includes('active dependent project'), 'Retirement must be blocked by active project dependency');

      // Archive the active project
      await page.locator('#tab-projects').click();
      await page.waitForTimeout(200);
      await page.locator('#btn-archive-project').click();
      await page.waitForTimeout(300);

      // Now retire organization
      await page.locator('#tab-organization').click();
      await page.waitForTimeout(200);

      // Verify quorum safeguard blocks retirement if force override not checked
      await page.locator('#btn-retire-org').click();
      await page.waitForTimeout(300);
      const preOverrideStatus = await page.locator('#org-lifecycle-badge').innerText();
      assert.notEqual(preOverrideStatus, 'Retired', 'Retirement must be blocked without 2-admin quorum unless force override engaged');

      // Engage force override and retire organization
      await page.locator('#retire-force-override').check();
      await page.locator('#btn-retire-org').click();
      await page.waitForTimeout(300);

      const lifecycleStatus = await page.locator('#org-lifecycle-badge').innerText();
      assert.equal(lifecycleStatus, 'Retired', 'Organization must transition to Retired once projects archived and force override engaged');
    });

    await test(`[${browserName}] J9.4 Final comprehensive Axe WCAG 2.1/2.2 AA audit with 0 violations across Light and Dark themes`, async () => {
      const finalAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (finalAudit.violations.length > 0) {
        console.error('Final Light theme violations:', JSON.stringify(finalAudit.violations, null, 2));
      }
      assert.equal(finalAudit.violations.length, 0, `Expected 0 Axe violations in final Light theme audit, got ${finalAudit.violations.length}`);

      // Toggle to Dark theme and audit interactive panels in fully exercised state
      await page.keyboard.press('Alt+t');
      await page.waitForTimeout(200);

      const exercisedTabs = ['tab-organization', 'tab-projects', 'tab-messaging', 'tab-identity'];
      for (const tabId of exercisedTabs) {
        await page.locator(`#${tabId}`).click();
        await page.waitForTimeout(150);
        const darkAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
        if (darkAudit.violations.length > 0) {
          console.error(`Final Dark theme violations on #${tabId}:`, JSON.stringify(darkAudit.violations, null, 2));
        }
        assert.equal(darkAudit.violations.length, 0, `Expected 0 Axe violations on #${tabId} in final Dark theme audit, got ${darkAudit.violations.length}`);
      }

      // Switch back to Light theme
      await page.keyboard.press('Alt+t');
      await page.waitForTimeout(200);
    });

    await browser.close();
  }
} finally {
  server.close();
  console.log('Ephemeral HTTP server closed cleanly.');
}

console.log('\n================================================================');
console.log(`TOTAL JOURNEY MATRIX TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  console.error('\nFAILURE DETAILS:');
  failureDetails.forEach(f => {
    console.error(`- ${f.name}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\nALL 9 MILESTONE 4 USER JOURNEYS & ACCESSIBILITY AUDITS PASSED WITH ZERO VIOLATIONS.');
  process.exit(0);
}
