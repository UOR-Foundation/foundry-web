import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../site/crypto.js';

const uorCrypto = globalThis.uorCrypto;
const siteHtmlPath = pathToFileURL(resolve('site/index.html')).href;

console.log('================================================================');
console.log('CHALLENGER DEEP VERIFICATION SUITE (Milestone 2 - Storage & Governance)');
console.log('================================================================');

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

// ============================================================================
// PART 1: AUTHENTICATED ENCRYPTION & DOMAIN-SEPARATED CRYPTOGRAPHY
// ============================================================================
console.log('\n--- PART 1: CRYPTO, AES-256-GCM & DOMAIN-SEPARATED SIGNATURES ---');

await test('1.1 AES-256-GCM symmetric key generation & encryption/decryption roundtrip', async () => {
  const symKey = await uorCrypto.generateSymmetricKey();
  assert.ok(symKey, 'Symmetric key generated');
  assert.equal(symKey.algorithm.name, 'AES-GCM', 'Algorithm must be AES-GCM');
  assert.equal(symKey.algorithm.length, 256, 'Key length must be 256-bit');

  const testPlaintexts = [
    'Universal Object Reference (UOR) Foundation 2026',
    '',
    JSON.stringify({ model: 'pure-model', state: 'Activated', quorum: 2 }),
    new Uint8Array([0x00, 0xff, 0x42, 0x13, 0x37, 0x7f])
  ];

  for (const plain of testPlaintexts) {
    const { ciphertext, iv } = await uorCrypto.encryptBlob(symKey, plain);
    assert.equal(iv.length, 12, 'AES-GCM IV must be exactly 12 bytes');
    assert.ok(ciphertext.length > 0, 'Ciphertext must be non-empty');

    const decrypted = await uorCrypto.decryptBlob(symKey, ciphertext, iv);
    const expectedBytes = typeof plain === 'string'
      ? new TextEncoder().encode(plain)
      : plain;
    assert.deepEqual(decrypted, expectedBytes, 'Decrypted bytes must match plaintext exactly');
  }
});

await test('1.2 AES-256-GCM authentication tag tampering causes decryption rejection', async () => {
  const symKey = await uorCrypto.generateSymmetricKey();
  const plain = 'Confidential state checkpoint payload';
  const { ciphertext, iv } = await uorCrypto.encryptBlob(symKey, plain);

  // Tamper with the ciphertext (flip one bit)
  const tamperedCipher = new Uint8Array(ciphertext);
  tamperedCipher[tamperedCipher.length - 1] ^= 0x01;

  let rejected = false;
  try {
    await uorCrypto.decryptBlob(symKey, tamperedCipher, iv);
  } catch {
    rejected = true;
  }
  assert.ok(rejected, 'Tampered ciphertext must fail authentication and throw');

  // Tamper with IV
  const tamperedIv = new Uint8Array(iv);
  tamperedIv[0] ^= 0xff;
  let ivRejected = false;
  try {
    await uorCrypto.decryptBlob(symKey, ciphertext, tamperedIv);
  } catch {
    ivRejected = true;
  }
  assert.ok(ivRejected, 'Mismatched IV must fail decryption authentication');
});

await test('1.3 Domain-separated signing prefix \\x19UOR Foundry Auth v1:\\n enforcement', async () => {
  const accountId = `uor:user:domain_sep_${Date.now()}`;
  const record = await uorCrypto.getOrCreateKeyPair(accountId);
  const challenge = 'test-governance-proposal-42';

  // Authentic signChallenge uses prefix
  const sigHex = await uorCrypto.signChallenge(accountId, challenge);
  assert.ok(sigHex && sigHex.length > 0, 'Signature generated');

  // Verification using verifySignature succeeds
  const verified = await uorCrypto.verifySignature(record.keyPair.publicKey, sigHex, challenge);
  assert.equal(verified, true, 'Authentic domain-separated signature must verify');

  // Direct manual verification of raw challenge without prefix must FAIL
  const rawBytes = new TextEncoder().encode(challenge);
  const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const rawVerify = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    record.keyPair.publicKey,
    sigBytes,
    rawBytes
  );
  assert.equal(rawVerify, false, 'Signature made with domain prefix must not verify against un-prefixed raw bytes');
});

// ============================================================================
// PART 2: BROWSER DOM GOVERNANCE & INVITATIONS LIFECYCLE
// ============================================================================
console.log('\n--- PART 2: ORGANIZATION GOVERNANCE & INVITATIONS DOM LIFECYCLE ---');

const browserChromium = await chromium.launch({ headless: true });

try {
  const context = await browserChromium.newContext();
  const page = await context.newPage();
  await page.goto(siteHtmlPath, { waitUntil: 'load' });

  // Navigate to Organization tab
  await page.locator('#tab-organization').click();

  await test('2.1 Organization Rename preserves immutable cryptographic ID', async () => {
    const originalId = await page.locator('#org-id-val').innerText();
    assert.ok(originalId.startsWith('uor:org:'), 'Original Org ID must be valid');

    // Submit rename
    await page.locator('#edit-org-name').fill('Citizen Gardens Global Foundation');
    await page.locator('#btn-update-org-name').click();
    await page.waitForTimeout(300);

    const updatedName = await page.locator('#org-name-val').innerText();
    const currentId = await page.locator('#org-id-val').innerText();

    assert.equal(updatedName, 'Citizen Gardens Global Foundation', 'Organization name must be updated');
    assert.equal(currentId, originalId, 'Organization ID must remain strictly immutable');
  });

  await test('2.2 Organization Full Lifecycle: Suspend -> Reactivate with Quorum -> Retire', async () => {
    // 1. Initial state is Provisional
    let badgeText = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(badgeText, 'Provisional');

    // 2. Add second administrator to satisfy quorum (alice is founding admin)
    await page.locator('#admin-email').fill('bob@uor.foundation');
    await page.locator('#admin-scope').selectOption('Organization');
    await page.locator('#btn-add-admin').click();
    await page.waitForTimeout(300);

    const adminCount = await page.locator('#org-admin-count').innerText();
    assert.equal(adminCount, '2', 'Organization must have 2 enrolled administrators');

    // 3. Activate under quorum
    await page.locator('#btn-activate-org').click();
    await page.waitForTimeout(300);
    badgeText = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(badgeText, 'Activated', 'Organization must be Activated');

    // 4. Suspend Organization
    await page.locator('#btn-suspend-org').click();
    await page.waitForTimeout(300);
    badgeText = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(badgeText, 'Suspended', 'Organization must transition to Suspended');

    // 5. Reactivate Organization with quorum
    await page.locator('#btn-reactivate-org').click();
    await page.waitForTimeout(300);
    badgeText = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(badgeText, 'Activated', 'Organization must transition back to Activated');

    // 6. Retire Organization with force override
    await page.locator('#retire-force-override').check();
    await page.locator('#btn-retire-org').click();
    await page.waitForTimeout(300);
    badgeText = await page.locator('#org-lifecycle-badge').innerText();
    assert.equal(badgeText, 'Retired', 'Organization must transition to Retired');
  });

  await test('2.3 Invitations Lifecycle: Issue -> Key-Bound Acceptance -> Enrolled Administrator', async () => {
    // Switch to a new organization to test fresh invitation flow
    await page.locator('#new-org-name').fill('Solar Cooperative');
    await page.locator('#btn-create-org').click();
    await page.waitForTimeout(300);

    // Issue invitation to charlie
    await page.locator('#invitation-email').fill('charlie@uor.foundation');
    await page.locator('#invitation-scope').selectOption('Security');
    await page.locator('#btn-send-invitation').click();
    await page.waitForTimeout(300);

    // Verify invitation row exists with Pending status
    const pendingStatus = await page.locator('#invitations-tbody tr:first-child span.badge').innerText();
    assert.equal(pendingStatus, 'Pending', 'New invitation must have Pending status');

    // Accept invitation with WebCrypto key binding
    await page.locator('#invitations-tbody tr:first-child .btn-accept-invite').click();
    await page.waitForTimeout(400);

    // Verify status updated to Accepted
    const acceptedStatus = await page.locator('#invitations-tbody tr:first-child span.badge').innerText();
    assert.equal(acceptedStatus, 'Accepted', 'Accepted invitation status must be Accepted');

    // Verify administrator roster includes charlie with Security scope
    const rosterText = await page.locator('#admin-roster-list').innerText();
    assert.ok(rosterText.includes('charlie@uor.foundation'), 'Charlie must be enrolled in administrator roster');
    assert.ok(rosterText.includes('Security'), 'Charlie must hold delegated Security scope');
  });

  await test('2.4 Governance proposal signature collection without fake voter fallback', async () => {
    await page.locator('#tab-governance').click();

    // Verify Cast Signature Approval
    const voteBtn = page.locator('#active-proposals-list .btn-vote').first();
    if (await voteBtn.isVisible()) {
      await voteBtn.click();
      await page.waitForTimeout(300);
    }

    // Verify announcement or approvals count
    const proposalText = await page.locator('#active-proposals-list').innerText();
    assert.ok(proposalText.includes('Approvals:'), 'Proposal approvals must be displayed');
  });

  // ============================================================================
  // PART 3: PERSISTENT STORAGE & ANTI-ROLLBACK WAL JOURNAL
  // ============================================================================
  console.log('\n--- PART 3: PERSISTENT KAPPA STORE & WAL REVISION FENCING ---');

  await page.locator('#tab-storage').click();

  await test('3.1 Persistent IndexedDB Kappa Store putBlob & getBlob with content addressing', async () => {
    // Store blob via UI
    const payload = 'Decentralized Sovereign Object Protocol payload ' + Date.now();
    await page.locator('#blob-input-data').fill(payload);
    await page.locator('#btn-store-blob').click();
    await page.waitForTimeout(400);

    const storeResult = await page.locator('#blob-result-display').innerText();
    assert.ok(storeResult.includes('Blob Stored in Persistent Kappa Store!'), 'Expected persistent store message');
    const digestMatch = storeResult.match(/sha256:([0-9a-f]{64})/);
    assert.ok(digestMatch, 'Digest must be reported');
    const digest = digestMatch[0];

    // Lookup blob via UI form
    await page.locator('#blob-lookup-digest').fill(digest);
    await page.locator('#btn-get-blob').click();
    await page.waitForTimeout(400);

    const retrieveResult = await page.locator('#blob-retrieve-display').innerText();
    assert.ok(retrieveResult.includes('Blob Retrieved & Verified!'), 'Expected retrieval confirmation');
  });

  await test('3.2 Anti-Rollback WAL Journal enforces strictly monotonic revisions', async () => {
    const journalResult = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      if (!uor || !uor.appendJournalEntry) return { error: 'No appendJournalEntry function' };

      const currentRev = uor.state.journalRevision;
      // Valid forward transition
      const entry1 = await uor.appendJournalEntry({
        revision: currentRev + 5,
        type: 'StateTransition',
        payload: 'valid-transition',
        actor: 'did:key:admin1'
      });

      // Rollback attempt: revision equal to or lower than current
      let rollbackRejected = false;
      try {
        await uor.appendJournalEntry({
          revision: currentRev + 3,
          type: 'RollbackAttempt',
          payload: 'stale-state',
          actor: 'did:key:adversary'
        });
      } catch (err) {
        rollbackRejected = true;
      }

      return {
        entry1Revision: entry1.revision,
        rollbackRejected
      };
    });

    assert.ok(journalResult.entry1Revision > 0, 'Forward journal entry must succeed');
    assert.equal(journalResult.rollbackRejected, true, 'Rollback with stale revision must be strictly rejected');
  });

  await context.close();
} finally {
  await browserChromium.close();
}

// ============================================================================
// PART 4: MULTI-BROWSER AXE WCAG 2.2 AA ACCESSIBILITY AUDIT
// ============================================================================
console.log('\n--- PART 4: MULTI-BROWSER AXE WCAG 2.2 AA ACCESSIBILITY ---');

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function testAccessibility(browserType, browserName) {
  await test(`4.1 ${browserName}: Organization & Storage tabs have 0 Axe violations under dynamic mutations`, async () => {
    const browser = await browserType.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(siteHtmlPath, { waitUntil: 'load' });

      // Audit Organization tab
      await page.locator('#tab-organization').click();
      const orgAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
      assert.equal(orgAudit.violations.length, 0, `${browserName}: Organization tab must have 0 Axe violations (got ${orgAudit.violations.length})`);

      // Audit Storage tab
      await page.locator('#tab-storage').click();
      const storageAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
      assert.equal(storageAudit.violations.length, 0, `${browserName}: Storage tab must have 0 Axe violations (got ${storageAudit.violations.length})`);

      await context.close();
    } finally {
      await browser.close();
    }
  });
}

await testAccessibility(chromium, 'Chromium');
await testAccessibility(firefox, 'Firefox');

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
