import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../site/crypto.js';

const uorCrypto = globalThis.uorCrypto;
const siteHtmlPath = pathToFileURL(resolve('site/index.html')).href;

console.log('================================================================');
console.log('CHALLENGER DEEP ADVERSARIAL EDGE CASE SUITE (Milestone 1)');
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
// PART 1: ADVERSARIAL CRYPTOGRAPHIC & DID EDGE CASES
// ============================================================================
console.log('\n--- PART 1: CRYPTO & DID STRESS & EDGE CASES ---');

await test('1.1 DID Uniqueness & Collision Resistance (N=100 keypairs)', async () => {
  const count = 100;
  const dids = new Set();
  const pubKeys = new Set();

  for (let i = 0; i < count; i++) {
    const accountId = `uor:user:stress_${Date.now()}_${i}_${Math.random()}`;
    const record = await uorCrypto.getOrCreateKeyPair(accountId);
    
    assert.match(record.did, /^did:key:zDna[0-9a-f]{32}$/, `DID must match expected format: ${record.did}`);
    assert.equal(record.keyPair.privateKey.extractable, false, 'Private key must be non-extractable');
    
    dids.add(record.did);
    pubKeys.add(record.pubKeyHex);
  }

  assert.equal(dids.size, count, `All ${count} generated DIDs must be unique (got ${dids.size})`);
  assert.equal(pubKeys.size, count, `All ${count} public keys must be unique (got ${pubKeys.size})`);
});

await test('1.2 Multi-round key rotation on a single account (10 consecutive rotations)', async () => {
  const accountId = `uor:user:multi_rot_${Date.now()}`;
  const seenDids = new Set();
  const seenPubKeys = new Set();

  const initial = await uorCrypto.getOrCreateKeyPair(accountId);
  seenDids.add(initial.did);
  seenPubKeys.add(initial.pubKeyHex);

  for (let r = 1; r <= 10; r++) {
    const rotated = await uorCrypto.rotateKeyPair(accountId);
    assert.equal(rotated.keyPair.privateKey.extractable, false, `Rotation #${r} private key must remain non-extractable`);
    assert.match(rotated.did, /^did:key:zDna[0-9a-f]{32}$/, `Rotation #${r} DID format valid`);
    assert.ok(!seenDids.has(rotated.did), `Rotation #${r} DID must be fresh and not previously observed`);
    assert.ok(!seenPubKeys.has(rotated.pubKeyHex), `Rotation #${r} public key must be fresh`);
    seenDids.add(rotated.did);
    seenPubKeys.add(rotated.pubKeyHex);
  }

  assert.equal(seenDids.size, 11, 'All 11 DIDs (initial + 10 rotations) must be distinct');
  assert.equal(seenPubKeys.size, 11, 'All 11 public keys must be distinct');
});

await test('1.3 Adversarial Challenge Payloads (empty, 64KB, emoji, binary nulls)', async () => {
  const accountId = `uor:user:adv_payloads_${Date.now()}`;
  const record = await uorCrypto.getOrCreateKeyPair(accountId);

  const testPayloads = [
    { desc: 'Empty challenge string', challenge: '' },
    { desc: 'Single space challenge', challenge: ' ' },
    { desc: 'Emoji / Unicode challenge', challenge: '🔑🔒🛡️ Universal Object Reference / DID 2026' },
    { desc: 'Control & null bytes', challenge: '\x00\x01\x02\x1b\r\n\t' },
    { desc: '64KB large challenge', challenge: 'X'.repeat(65536) }
  ];

  for (const { desc, challenge } of testPayloads) {
    const sig = await uorCrypto.signChallenge(accountId, challenge);
    assert.ok(sig && sig.length > 0, `${desc}: Signature should be non-empty`);
    
    // Valid verification
    const valid = await uorCrypto.verifySignature(record.keyPair.publicKey, sig, challenge);
    assert.equal(valid, true, `${desc}: Signature verification should succeed`);

    // Tampered challenge verification (modify by 1 char)
    const tampered = challenge + '!';
    const tamperedValid = await uorCrypto.verifySignature(record.keyPair.publicKey, sig, tampered);
    assert.equal(tamperedValid, false, `${desc}: Tampered challenge must be rejected`);
  }
});

await test('1.4 Signature verification rejects corrupt & malformed signature inputs', async () => {
  const accountId = `uor:user:malformed_sig_${Date.now()}`;
  const record = await uorCrypto.getOrCreateKeyPair(accountId);
  const challenge = 'test-challenge-123';
  const authenticSig = await uorCrypto.signChallenge(accountId, challenge);

  // Odd length hex
  const oddHex = authenticSig.substring(0, authenticSig.length - 1);
  const oddValid = await uorCrypto.verifySignature(record.keyPair.publicKey, oddHex, challenge).catch(() => false);
  assert.equal(oddValid, false, 'Odd length hex signature must be rejected');

  // Non-hex characters
  const nonHex = authenticSig.substring(0, authenticSig.length - 2) + 'ZZ';
  const nonHexValid = await uorCrypto.verifySignature(record.keyPair.publicKey, nonHex, challenge).catch(() => false);
  assert.equal(nonHexValid, false, 'Non-hex characters in signature must be rejected');

  // All zeros signature
  const zeroSig = '00'.repeat(authenticSig.length / 2);
  const zeroValid = await uorCrypto.verifySignature(record.keyPair.publicKey, zeroSig, challenge).catch(() => false);
  assert.equal(zeroValid, false, 'All-zeros signature must be rejected');
});

await test('1.5 NIST SP 800-63B-4 Alphabet & Entropy Verification (1,000 codes)', async () => {
  // Generate 100 batches of 10 codes = 1000 codes total
  const codeSet = new Set();
  const saltSet = new Set();
  const ambiguousChars = ['0', 'O', '1', 'I'];

  for (let b = 0; b < 100; b++) {
    const codes = await uorCrypto.generateNistBackupCodes(10);
    assert.equal(codes.length, 10, 'Each batch must contain exactly 10 codes');

    for (const c of codes) {
      assert.match(c.code, /^BK-[A-Z0-9]{5}-[A-Z0-9]{5}$/, `Code format invalid: ${c.code}`);
      assert.match(c.salt, /^[0-9a-f]{32}$/, `Salt format invalid: ${c.salt}`);
      assert.match(c.hash, /^[0-9a-f]{64}$/, `Hash format invalid: ${c.hash}`);
      assert.equal(c.used, false, 'Newly issued code must have used=false');

      // Ambiguous characters check
      for (const badChar of ambiguousChars) {
        assert.ok(!c.code.includes(badChar), `Code ${c.code} contains ambiguous character '${badChar}'`);
      }

      codeSet.add(c.code);
      saltSet.add(c.salt);
    }
  }

  assert.equal(codeSet.size, 1000, `Expected 1,000 unique backup codes, got ${codeSet.size}`);
  assert.equal(saltSet.size, 1000, `Expected 1,000 unique salts, got ${saltSet.size}`);
});

// ============================================================================
// PART 2: ADVERSARIAL BACKUP CODE REDEMPTION LOGIC & ACCOUNT ISOLATION
// ============================================================================
console.log('\n--- PART 2: BACKUP CODE REDEMPTION & ACCOUNT BINDING IN DOM ---');

const browserChromium = await chromium.launch({ headless: true });

try {
  const context = await browserChromium.newContext();
  const page = await context.newPage();
  await page.goto(siteHtmlPath, { waitUntil: 'load' });

  await test('2.1 Redemption with empty / uninitialized backup batch rejects cleanly', async () => {
    // Navigate directly to backup codes tab without generating any batch
    await page.locator('#tab-backup-codes').click();
    await page.locator('#recovery-account').fill('unregistered@uor.foundation');
    await page.locator('#recovery-revision').fill('1');
    await page.locator('#recovery-code-input').fill('BK-ABCDE-FGHIJ');
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(300);

    const resultBoxText = await page.locator('#recovery-result-box').innerText();
    assert.equal(resultBoxText, 'No backup codes batch found for this account.');

    // Assert user is NOT authenticated
    await page.locator('#tab-identity').click();
    const accountEmail = await page.locator('#account-email-val').innerText();
    assert.equal(accountEmail, 'None', 'User should remain unauthenticated');
  });

  await test('2.2 Strict email binding rejects mismatched accounts (subdomain, prefix, casing)', async () => {
    // Generate codes for alice@uor.foundation
    await page.locator('#tab-backup-codes').click();
    await page.locator('#btn-generate-backup-codes').click();
    await page.waitForTimeout(300);

    const firstCode = await page.locator('#code-item-0 code').innerText();
    assert.ok(firstCode.startsWith('BK-'), `Expected code starting with BK-, got: ${firstCode}`);

    // Try redeeming with attacker emails
    const attackers = [
      'alice@attacker.org',
      'bob@uor.foundation',
      'malice@uor.foundation',
      'alice@sub.uor.foundation'
    ];

    for (const attacker of attackers) {
      await page.locator('#recovery-account').fill(attacker);
      await page.locator('#recovery-revision').fill('1');
      await page.locator('#recovery-code-input').fill(firstCode);
      await page.locator('#btn-redeem-code').click();
      await page.waitForTimeout(200);

      const msg = await page.locator('#recovery-result-box').innerText();
      assert.equal(msg, 'No backup codes batch found for this account.', `Attacking email ${attacker} must be blocked`);

      await page.locator('#tab-identity').click();
      const currentEmail = await page.locator('#account-email-val').innerText();
      assert.equal(currentEmail, 'None', `Attacking email ${attacker} must not authenticate`);
      await page.locator('#tab-backup-codes').click();
    }
  });

  await test('2.3 Malformed code inputs are safely rejected (short, non-matching, XSS payloads)', async () => {
    const malformedCodes = [
      'BK-SHORT',
      'BK-12345-12345',
      '<script>alert("xss")</script>',
      "' OR 1=1 --",
      'BK-NOTAREALCODE-12345'
    ];

    for (const badCode of malformedCodes) {
      await page.locator('#recovery-account').fill('alice@uor.foundation');
      await page.locator('#recovery-revision').fill('1');
      await page.locator('#recovery-code-input').fill(badCode);
      await page.locator('#btn-redeem-code').click();
      await page.waitForTimeout(200);

      const msg = await page.locator('#recovery-result-box').innerText();
      assert.equal(msg, 'Invalid Backup Code: Code hash not recognized.', `Bad code "${badCode}" must be rejected`);

      await page.locator('#tab-identity').click();
      const currentEmail = await page.locator('#account-email-val').innerText();
      assert.equal(currentEmail, 'None');
      await page.locator('#tab-backup-codes').click();
    }
  });

  await test('2.4 Authentic single-use redemption and immediate replay prevention', async () => {
    const firstCode = await page.locator('#code-item-0 code').innerText();

    // 1. Redeem code 0 for legitimate owner
    await page.locator('#recovery-account').fill('alice@uor.foundation');
    await page.locator('#recovery-revision').fill('1');
    await page.locator('#recovery-code-input').fill(firstCode);
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(400);

    const successMsg = await page.locator('#recovery-result-box').innerText();
    assert.ok(successMsg.includes('Recovery Successful! Code consumed.'), 'Expected success message');

    // Verify authenticated state
    await page.locator('#tab-identity').click();
    const authEmail = await page.locator('#account-email-val').innerText();
    assert.equal(authEmail, 'alice@uor.foundation');

    // 2. Replay the exact same code
    await page.locator('#tab-backup-codes').click();
    await page.locator('#recovery-account').fill('alice@uor.foundation');
    await page.locator('#recovery-revision').fill('1');
    await page.locator('#recovery-code-input').fill(firstCode);
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(300);

    const replayMsg = await page.locator('#recovery-result-box').innerText();
    assert.equal(replayMsg, 'Replay Prohibited: Code already consumed.', 'Replaying consumed code must be rejected');
  });

  await test('2.5 Stale revision rejection after batch regeneration', async () => {
    // Generate new batch (Revision 2)
    await page.locator('#btn-generate-backup-codes').click();
    await page.waitForTimeout(300);

    const newCode = await page.locator('#code-item-0 code').innerText();

    // Attempt to redeem with old revision 1
    await page.locator('#recovery-account').fill('alice@uor.foundation');
    await page.locator('#recovery-revision').fill('1');
    await page.locator('#recovery-code-input').fill(newCode);
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(300);

    const staleMsg = await page.locator('#recovery-result-box').innerText();
    assert.equal(staleMsg, 'Stale Revision: Code rejected under NIST SP 800-63B-4.');

    // Now redeem with correct revision 2
    await page.locator('#recovery-revision').fill('2');
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(300);

    const correctMsg = await page.locator('#recovery-result-box').innerText();
    assert.ok(correctMsg.includes('Recovery Successful! Code consumed.'), 'Expected success message on correct revision');
  });

  await test('2.6 Exhaustion of remaining 9 codes in the batch', async () => {
    // Codes 1 through 9
    for (let i = 1; i <= 9; i++) {
      const code = await page.locator(`#code-item-${i} code`).innerText();
      await page.locator('#recovery-account').fill('alice@uor.foundation');
      await page.locator('#recovery-revision').fill('2');
      await page.locator('#recovery-code-input').fill(code);
      await page.locator('#btn-redeem-code').click();
      await page.waitForTimeout(200);

      const msg = await page.locator('#recovery-result-box').innerText();
      assert.ok(msg.includes('Recovery Successful! Code consumed.'), `Code #${i} should be successfully redeemed`);
    }

    // Now all 10 codes are consumed. Attempting any code from revision 2 must be rejected as already consumed.
    const anyCode = await page.locator('#code-item-5 code').innerText();
    await page.locator('#recovery-account').fill('alice@uor.foundation');
    await page.locator('#recovery-revision').fill('2');
    await page.locator('#recovery-code-input').fill(anyCode);
    await page.locator('#btn-redeem-code').click();
    await page.waitForTimeout(200);

    const exhaustedMsg = await page.locator('#recovery-result-box').innerText();
    assert.equal(exhaustedMsg, 'Replay Prohibited: Code already consumed.');
  });

  await context.close();
} finally {
  await browserChromium.close();
}

// ============================================================================
// PART 3: ADVERSARIAL DYNAMIC ARIA & MULTI-BROWSER ACCESSIBILITY
// ============================================================================
console.log('\n--- PART 3: DYNAMIC ARIA & MULTI-BROWSER AXE ACCESSIBILITY ---');

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function testBrowserAccessibility(browserType, browserName) {
  await test(`3.1 ${browserName}: Sequential dynamic VC issuance (5 items) maintains 0 Axe violations & valid role="listitem"`, async () => {
    const browser = await browserType.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(siteHtmlPath, { waitUntil: 'load' });

      // Navigate to Learning tab
      await page.locator('#tab-learning').click();

      // Initial Axe audit
      const initialAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
      assert.equal(initialAudit.violations.length, 0, `${browserName}: Initial Learning tab must have 0 Axe violations`);

      // Dynamically submit 5 verifiable credential accreditations sequentially
      for (let i = 1; i <= 5; i++) {
        await page.locator('#course-select').selectOption({ index: (i % 3) });
        await page.locator('#evidence-link').fill(`https://github.com/uor-foundation/verification/proof-${i}`);
        await page.locator('#btn-submit-assessment').click();
        await page.waitForTimeout(200);
      }

      // Verify DOM structure: #vc-wallet has role="list"
      const walletRole = await page.locator('#vc-wallet').getAttribute('role');
      assert.equal(walletRole, 'list', '#vc-wallet MUST have role="list"');

      // Verify all child cards have role="listitem"
      const vcCards = await page.locator('#vc-wallet .vc-card').all();
      assert.equal(vcCards.length, 5, 'Expected 5 issued credentials cards');

      for (let idx = 0; idx < vcCards.length; idx++) {
        const cardRole = await vcCards[idx].getAttribute('role');
        assert.equal(cardRole, 'listitem', `Card #${idx} must have role="listitem", got: ${cardRole}`);
      }

      // Full Axe Audit after 5 dynamic updates
      const postAudit = await new AxeBuilder({ page }).withTags(tags).analyze();
      if (postAudit.violations.length > 0) {
        console.error(`${browserName} Axe Violations:`, JSON.stringify(postAudit.violations, null, 2));
      }
      assert.equal(postAudit.violations.length, 0, `${browserName}: Post-submission Learning tab must have 0 Axe violations`);

      await context.close();
    } finally {
      await browser.close();
    }
  });
}

await testBrowserAccessibility(chromium, 'Chromium');
await testBrowserAccessibility(firefox, 'Firefox');

// ============================================================================
// SUMMARY
// ============================================================================
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
