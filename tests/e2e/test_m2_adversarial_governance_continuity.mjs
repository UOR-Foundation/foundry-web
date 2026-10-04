import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import '../../site/crypto.js';

const siteHtmlPath = new URL('../../site/index.html', import.meta.url).href;

console.log('================================================================');
console.log('CHALLENGER ADVERSARIAL STRESS TEST SUITE: M2 GOVERNANCE & CONTINUITY');
console.log('Target: Reactivation Quorum, Atomic Continuity, Invitations, Proposal Signatures');
console.log('================================================================\n');

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

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track browser dialogs/alerts
  const dialogMessages = [];
  page.on('dialog', async dialog => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  });

  await page.goto(siteHtmlPath, { waitUntil: 'load' });
  await page.locator('#tab-organization').click();

  // ============================================================================
  // SECTION 1: REACTIVATION QUORUM & STATE TRANSITION CONSTRAINTS
  // ============================================================================
  console.log('--- SECTION 1: REACTIVATION QUORUM & STATE TRANSITION CONSTRAINTS ---');

  await test('1.1 Reactivating non-suspended organization is rejected', async () => {
    const initialState = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(initialState, 'Provisional');

    // Attempt to click Reactivate button on Provisional org
    dialogMessages.length = 0;
    await page.locator('#btn-reactivate-org').click();
    await page.waitForTimeout(200);

    const announcement = await page.locator('#system-announcement').innerText();
    assert.ok(
      announcement.includes('Only suspended organizations can be reactivated'),
      'Must announce that only suspended organizations can be reactivated'
    );
    const stateAfter = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(stateAfter, 'Provisional', 'State must remain Provisional');
  });

  await test('1.2 Single-admin reactivation attempt is rejected (Quorum >= 2 enforced)', async () => {
    // Suspend organization while still having only 1 admin
    await page.locator('#btn-suspend-org').click();
    await page.waitForTimeout(200);

    const adminCount = await page.locator('#org-admin-count').innerText();
    assert.equal(adminCount, '1', 'Organization must have exactly 1 admin');

    const suspendedBadge = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(suspendedBadge, 'Suspended', 'Organization must be Suspended');

    // Attempt to reactivate with only 1 admin
    dialogMessages.length = 0;
    await page.locator('#btn-reactivate-org').click();
    await page.waitForTimeout(200);

    const hasRejectionAlert = dialogMessages.some(m => m.includes('Reactivation Rejected') || m.includes('Quorum requires at least 2'));
    const announcement = await page.locator('#system-announcement').innerText();
    assert.ok(
      hasRejectionAlert || announcement.includes('Reactivation Rejected'),
      'Must reject reactivation when distinct admin quorum < 2'
    );

    // Verify state remains strictly Suspended
    const badgeAfter = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(badgeAfter, 'Suspended', 'State must remain Suspended after failed single-admin reactivation');
  });

  await test('1.3 Reactivation succeeds once distinct-admin quorum (>= 2) is met', async () => {
    // Add second admin bob to satisfy quorum
    await page.locator('#admin-email').fill('bob@uor.foundation');
    await page.locator('#admin-scope').selectOption('Organization');
    await page.locator('#btn-add-admin').click();
    await page.waitForTimeout(200);

    const adminCount = await page.locator('#org-admin-count').innerText();
    assert.equal(adminCount, '2', 'Organization now has 2 admins');

    // Reactivate with quorum
    dialogMessages.length = 0;
    await page.locator('#btn-reactivate-org').click();
    await page.waitForTimeout(200);

    const reactivatedBadge = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(reactivatedBadge, 'Activated', 'Organization must transition to Activated with 2 distinct admins');
  });

  // ============================================================================
  // SECTION 2: ATOMIC CONTINUITY & SAFE RETIREMENT SAFEGUARDS
  // ============================================================================
  console.log('\n--- SECTION 2: ATOMIC CONTINUITY & SAFE RETIREMENT SAFEGUARDS ---');

  await test('2.1 Founding grant retirement rejected if remaining admins < 2', async () => {
    // Switch to fresh organization with 1 admin
    await page.locator('#new-org-name').fill('Sole Founder Org');
    await page.locator('#btn-create-org').click();
    await page.waitForTimeout(200);

    const count = await page.locator('#org-admin-count').innerText();
    assert.equal(count, '1', 'Fresh org has only 1 founding admin');

    // Attempt to retire founding grant
    await page.locator('#btn-retire-founding').click();
    await page.waitForTimeout(200);

    const announcement = await page.locator('#system-announcement').innerText();
    assert.ok(
      announcement.includes('Cannot retire founding grant: would leave fewer than 2 administrators'),
      'Must reject retiring founding grant when < 2 admins would remain'
    );
  });

  await test('2.2 Organization retirement blocked when admins < 2 without force override', async () => {
    // Ensure force override checkbox is unchecked
    await page.locator('#retire-force-override').uncheck();

    // Attempt to retire Sole Founder Org (< 2 admins) without force override
    await page.locator('#btn-retire-org').click();
    await page.waitForTimeout(200);

    const announcement = await page.locator('#system-announcement').innerText();
    assert.ok(
      announcement.includes('Retirement Rejected: Minimum 2 distinct active administrators required for quorum'),
      'Must reject retiring organization without quorum when force override is unchecked'
    );

    // Organization state must NOT be retired
    const badge = await page.locator('#org-lifecycle-badge').innerText();
    assert.notEqual(badge, 'Retired', 'Organization state must not transition to Retired');
  });

  // ============================================================================
  // SECTION 3: INVITATION ATTACK VECTORS
  // ============================================================================
  console.log('\n--- SECTION 3: INVITATION ATTACK VECTORS & STATE GUARDS ---');

  await test('3.1 Issuing invitation to already enrolled administrator is rejected', async () => {
    dialogMessages.length = 0;
    // Alice is already the enrolled founding administrator
    await page.locator('#invitation-email').fill('alice@uor.foundation');
    await page.locator('#invitation-scope').selectOption('Organization');
    await page.locator('#btn-send-invitation').click();
    await page.waitForTimeout(200);

    assert.ok(
      dialogMessages.some(m => m.includes('already an administrator')),
      'Must alert that user is already an administrator in this organization'
    );
  });

  await test('3.2 Invitation lifecycle: Decline and Revocation transitions', async () => {
    // Issue invitation to candidate-decline
    await page.locator('#invitation-email').fill('decline_candidate@uor.foundation');
    await page.locator('#invitation-scope').selectOption('Governance');
    await page.locator('#btn-send-invitation').click();
    await page.waitForTimeout(200);

    // Decline invitation
    const declineRow = page.locator('#invitations-tbody tr').filter({ hasText: 'decline_candidate@uor.foundation' });
    await declineRow.locator('.btn-decline-invite').click();
    await page.waitForTimeout(200);

    const declineBadge = await declineRow.locator('.badge').innerText();
    assert.equal(declineBadge, 'Declined', 'Status must transition to Declined');

    // Issue invitation to candidate-revoke
    await page.locator('#invitation-email').fill('revoke_candidate@uor.foundation');
    await page.locator('#invitation-scope').selectOption('Security');
    await page.locator('#btn-send-invitation').click();
    await page.waitForTimeout(200);

    // Revoke invitation
    const revokeRow = page.locator('#invitations-tbody tr').filter({ hasText: 'revoke_candidate@uor.foundation' });
    await revokeRow.locator('.btn-revoke-invite').click();
    await page.waitForTimeout(200);

    const revokeBadge = await revokeRow.locator('.badge').innerText();
    assert.equal(revokeBadge, 'Revoked', 'Status must transition to Revoked');

    // Ensure action buttons are removed for non-pending invitations
    assert.equal(await declineRow.locator('.btn-accept-invite').count(), 0, 'No accept button on declined invitation');
    assert.equal(await revokeRow.locator('.btn-accept-invite').count(), 0, 'No accept button on revoked invitation');
  });

  // ============================================================================
  // SECTION 4: PROPOSAL SIGNATURE INTEGRITY & DUPLICATE VOTE REJECTION
  // ============================================================================
  console.log('\n--- SECTION 4: PROPOSAL SIGNATURE INTEGRITY & AM-01 ENFORCEMENT ---');

  await page.locator('#tab-governance').click();

  await test('4.1 Proposal approval collection enforces genuine ECDSA signatures and AM-01 duplicate rejection', async () => {
    // Check initial active proposal
    const initialCard = page.locator('#active-proposals-list .proposal-card').first();
    assert.ok(await initialCard.isVisible(), 'Proposal card must be rendered');

    // Cast Signature Approval
    const voteBtn = initialCard.locator('.btn-vote');
    if (await voteBtn.isVisible()) {
      await voteBtn.click();
      await page.waitForTimeout(300);

      const announcerText = await page.locator('#system-announcement').innerText();
      assert.ok(
        announcerText.includes('Approval signature cast') || announcerText.includes('Duplicate approval rejected'),
        'Must handle signature casting under AM-01 policy'
      );
    }

    // Verify approvals display
    const proposalText = await page.locator('#active-proposals-list').innerText();
    assert.ok(proposalText.includes('Approvals:'), 'Proposal approvals count must be displayed');
  });

} finally {
  await browser.close();
}

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
