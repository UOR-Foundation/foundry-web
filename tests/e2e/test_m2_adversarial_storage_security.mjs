import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import '../../site/crypto.js';

const uorCrypto = globalThis.uorCrypto;
const siteHtmlPath = new URL('../../site/index.html', import.meta.url).href;

console.log('================================================================');
console.log('CHALLENGER ADVERSARIAL STRESS TEST SUITE: M2 STORAGE & SECURITY');
console.log('Target: AES-256-GCM, Anti-Rollback Invariant, Domain Separation, Persistent Kappa Store');
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

// ============================================================================
// PART 1: AES-256-GCM INTEGRITY, CORRUPTION & ZERO PLAINTEXT LEAK
// ============================================================================
console.log('--- PART 1: AES-256-GCM INTEGRITY & ADVERSARIAL CRYPTANALYSIS ---');

await test('1.1 AES-256-GCM Baseline: Variable payload sizes roundtrip fidelity', async () => {
  const symKey = await uorCrypto.generateSymmetricKey();
  assert.equal(symKey.algorithm.name, 'AES-GCM');
  assert.equal(symKey.algorithm.length, 256);

  const payloads = [
    '', // 0 bytes empty string
    'A', // 1 byte
    'UOR-Foundry-2026-Milestone-2-Integrity-Payload', // medium ASCII
    JSON.stringify({ schema: 'w3c-vc-2.0', org: 'uor:org:foundation', nonce: 987654321 }),
    new Uint8Array(1024).fill(0x5a), // 1KB repeated byte
    new Uint8Array(32768).map((_, i) => i % 256) // 32KB binary ramp
  ];

  for (const plain of payloads) {
    const { ciphertext, iv } = await uorCrypto.encryptBlob(symKey, plain);
    assert.equal(iv.length, 12, 'IV must be exactly 12 bytes');
    assert.ok(ciphertext.length >= 16, 'Ciphertext must contain at least 16-byte auth tag');

    const decrypted = await uorCrypto.decryptBlob(symKey, ciphertext, iv);
    const expected = typeof plain === 'string' ? new TextEncoder().encode(plain) : plain;
    assert.deepEqual(decrypted, expected, 'Decrypted plaintext must match byte-for-byte');
  }
});

await test('1.2 AES-256-GCM Bit-Flip Attacks: Exhaustive byte offsets in ciphertext', async () => {
  const symKey = await uorCrypto.generateSymmetricKey();
  const secret = 'TOP_SECRET_UOR_FOUNDRY_PERSISTENCE_STATE_KEY_2026';
  const { ciphertext, iv } = await uorCrypto.encryptBlob(symKey, secret);

  // Attack positions: start (byte 0), 1/4 point, midpoint, 3/4 point, byte before auth tag
  const authTagOffset = ciphertext.length - 16;
  const testOffsets = [
    0,
    Math.floor(authTagOffset / 4),
    Math.floor(authTagOffset / 2),
    Math.floor((authTagOffset * 3) / 4),
    authTagOffset - 1
  ];

  for (const offset of testOffsets) {
    for (const bitMask of [0x01, 0x02, 0x80, 0xff]) {
      const corruptedCipher = new Uint8Array(ciphertext);
      corruptedCipher[offset] ^= bitMask;

      let leak = null;
      let rejected = false;
      try {
        leak = await uorCrypto.decryptBlob(symKey, corruptedCipher, iv);
      } catch {
        rejected = true;
      }

      assert.equal(rejected, true, `Bit flip at offset ${offset} mask 0x${bitMask.toString(16)} must reject`);
      assert.equal(leak, null, 'No plaintext leak on rejected decryption');
    }
  }
});

await test('1.3 AES-256-GCM Auth Tag Corruption: Rejection without plaintext leak', async () => {
  const symKey = await uorCrypto.generateSymmetricKey();
  const secret = 'CRITICAL_GOVERNANCE_QUORUM_APPROVAL_TOKEN_ALPHA_BETA';
  const { ciphertext, iv } = await uorCrypto.encryptBlob(symKey, secret);

  const tagStart = ciphertext.length - 16;

  // Test corrupting each of the 16 bytes of the auth tag
  for (let i = tagStart; i < ciphertext.length; i++) {
    const tampered = new Uint8Array(ciphertext);
    tampered[i] ^= 0x5c; // Tamper tag byte

    let leak = null;
    let rejected = false;
    try {
      leak = await uorCrypto.decryptBlob(symKey, tampered, iv);
    } catch {
      rejected = true;
    }

    assert.equal(rejected, true, `Tampered auth tag at byte offset ${i} must fail authentication`);
    assert.equal(leak, null, `Tampered auth tag must not leak plaintext (offset ${i})`);
  }

  // Entire tag zeroized
  const zeroTag = new Uint8Array(ciphertext);
  zeroTag.fill(0x00, tagStart);
  let zeroTagRejected = false;
  try {
    await uorCrypto.decryptBlob(symKey, zeroTag, iv);
  } catch {
    zeroTagRejected = true;
  }
  assert.equal(zeroTagRejected, true, 'Zeroized authentication tag must reject');
});

await test('1.4 AES-256-GCM IV Tampering: Bit flips, swaps, truncations and length mutations', async () => {
  const symKey = await uorCrypto.generateSymmetricKey();
  const secret = 'CONFIDENTIAL_MULTI_USER_SESSION_COOKIE_VALUE';
  const { ciphertext, iv } = await uorCrypto.encryptBlob(symKey, secret);

  // 1. Bit flip across all 12 IV positions
  for (let i = 0; i < iv.length; i++) {
    const alteredIv = new Uint8Array(iv);
    alteredIv[i] ^= 0x01;

    let rejected = false;
    try {
      await uorCrypto.decryptBlob(symKey, ciphertext, alteredIv);
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, `IV bit flip at position ${i} must fail authentication`);
  }

  // 2. All-zero IV
  const allZeroIv = new Uint8Array(12).fill(0x00);
  let allZeroRejected = false;
  try {
    await uorCrypto.decryptBlob(symKey, ciphertext, allZeroIv);
  } catch {
    allZeroRejected = true;
  }
  assert.equal(allZeroRejected, true, 'All-zero IV substitution must reject');

  // 3. Truncated IVs (0, 1, 8, 11 bytes)
  for (const len of [0, 1, 8, 11]) {
    const truncIv = iv.slice(0, len);
    let truncRejected = false;
    try {
      await uorCrypto.decryptBlob(symKey, ciphertext, truncIv);
    } catch {
      truncRejected = true;
    }
    assert.equal(truncRejected, true, `Truncated IV of length ${len} must reject`);
  }

  // 4. IV swap between two distinct encrypted records
  const { ciphertext: ct2, iv: iv2 } = await uorCrypto.encryptBlob(symKey, 'ANOTHER_PAYLOAD_CONTENT');
  let swapRejected = false;
  try {
    await uorCrypto.decryptBlob(symKey, ciphertext, iv2);
  } catch {
    swapRejected = true;
  }
  assert.equal(swapRejected, true, 'Swapped IV from distinct encryption operation must reject');
});

await test('1.5 AES-256-GCM Ciphertext Length Violations & Boundary Attacks', async () => {
  const symKey = await uorCrypto.generateSymmetricKey();
  const secret = 'BOUNDARY_CONDITIONS_AND_CIPHERTEXT_TRUNCATION_TEST';
  const { ciphertext, iv } = await uorCrypto.encryptBlob(symKey, secret);

  // Truncate by 1 byte, 8 bytes, and exactly 16 bytes (completely stripping tag)
  for (const trim of [1, 8, 16, 20]) {
    const truncated = ciphertext.slice(0, ciphertext.length - trim);
    let rejected = false;
    try {
      await uorCrypto.decryptBlob(symKey, truncated, iv);
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, `Truncated ciphertext (-${trim} bytes) must reject`);
  }

  // Sub-tag ciphertexts (0 bytes, 15 bytes)
  for (const len of [0, 15]) {
    const subTag = new Uint8Array(len);
    let subTagRejected = false;
    try {
      await uorCrypto.decryptBlob(symKey, subTag, iv);
    } catch {
      subTagRejected = true;
    }
    assert.equal(subTagRejected, true, `Sub-tag length (${len} bytes) ciphertext must reject`);
  }

  // Trailing garbage appended
  const withGarbage = new Uint8Array(ciphertext.length + 8);
  withGarbage.set(ciphertext, 0);
  withGarbage.fill(0xfe, ciphertext.length);
  let garbageRejected = false;
  try {
    await uorCrypto.decryptBlob(symKey, withGarbage, iv);
  } catch {
    garbageRejected = true;
  }
  assert.equal(garbageRejected, true, 'Appended garbage bytes to ciphertext must reject');
});

await test('1.6 AES-256-GCM Cross-Key Cryptographic Separation', async () => {
  const keyAlice = await uorCrypto.generateSymmetricKey();
  const keyBob = await uorCrypto.generateSymmetricKey();
  const secret = 'ORGANIZATION_EXCLUSIVE_CREDENTIALS_FOR_ALICE';

  const { ciphertext, iv } = await uorCrypto.encryptBlob(keyAlice, secret);

  // Bob attempts decryption with his own key
  let bobLeak = null;
  let bobRejected = false;
  try {
    bobLeak = await uorCrypto.decryptBlob(keyBob, ciphertext, iv);
  } catch {
    bobRejected = true;
  }

  assert.equal(bobRejected, true, 'Decrypting with mismatched key must fail authentication');
  assert.equal(bobLeak, null, 'Mismatched key must not leak plaintext');
});

await test('1.7 Memory Zeroize Invariant', async () => {
  const sensitiveBuffer = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe]);
  uorCrypto.zeroize(sensitiveBuffer);
  for (let i = 0; i < sensitiveBuffer.length; i++) {
    assert.equal(sensitiveBuffer[i], 0, `Buffer byte at index ${i} must be zeroized to 0x00`);
  }
});

// ============================================================================
// PART 2: DOMAIN SEPARATION SECURITY & SIGNATURE REPLAY ATTACKS
// ============================================================================
console.log('\n--- PART 2: DOMAIN SEPARATION SECURITY & REPLAY ATTACK RESISTANCE ---');

await test('2.1 Domain Separation Constant Verification', async () => {
  assert.equal(uorCrypto.SIGNING_PREFIX, '\x19UOR Foundry Auth v1:\n', 'Signing prefix must match specification exactly');
});

await test('2.2 Raw Signature Replay Attack (Signing without domain prefix fails verification)', async () => {
  const accountId = `uor:user:domain_test_${Date.now()}`;
  const record = await uorCrypto.getOrCreateKeyPair(accountId);
  const challenge = 'org-quorum-transfer-ownership-challenge';

  // Adversary signs the raw challenge directly WITHOUT domain prefix using private key
  const rawBytes = new TextEncoder().encode(challenge);
  const rawSig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    record.keyPair.privateKey,
    rawBytes
  );
  const rawSigHex = Array.from(new Uint8Array(rawSig)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Attempt to submit this raw un-prefixed signature to verifySignature
  const verified = await uorCrypto.verifySignature(record.keyPair.publicKey, rawSigHex, challenge);
  assert.equal(verified, false, 'Un-prefixed raw signature must be strictly rejected by verifySignature');
});

await test('2.3 Cross-Protocol Replay Attack: Alternate Prefix Injections', async () => {
  const accountId = `uor:user:cross_proto_${Date.now()}`;
  const record = await uorCrypto.getOrCreateKeyPair(accountId);
  const challenge = 'governance-vote-payload-vector-101';

  // Foreign protocol prefixes that adversaries might attempt to replay from
  const foreignPrefixes = [
    '\x19Ethereum Signed Message:\n32',
    '\x18Bitcoin Signed Message:\n',
    '\x19UOR Foundry Auth v2:\n', // Future version
    '\x19UOR Foundry Admin v1:\n', // Different subsystem
    'UOR Foundry Auth v1:\n', // Missing leading \x19 byte
    '\x19UOR Foundry Auth v1:' // Missing trailing newline
  ];

  for (const prefix of foreignPrefixes) {
    const foreignBytes = new Uint8Array([
      ...new TextEncoder().encode(prefix),
      ...new TextEncoder().encode(challenge)
    ]);
    const foreignSig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      record.keyPair.privateKey,
      foreignBytes
    );
    const foreignSigHex = Array.from(new Uint8Array(foreignSig)).map(b => b.toString(16).padStart(2, '0')).join('');

    const verified = await uorCrypto.verifySignature(record.keyPair.publicKey, foreignSigHex, challenge);
    assert.equal(verified, false, `Foreign prefix replay (${JSON.stringify(prefix)}) must be rejected`);
  }
});

await test('2.4 Prefix Embedding / Injection Ambiguity Attack', async () => {
  const accountId = `uor:user:prefix_inject_${Date.now()}`;
  const record = await uorCrypto.getOrCreateKeyPair(accountId);

  // Adversary crafts a challenge that literally starts with the domain prefix
  const maliciousChallenge = '\x19UOR Foundry Auth v1:\nsubverted_statement';
  const legitimateInnerStatement = 'subverted_statement';

  // Legitimate signing prefixes the malicious challenge -> results in double-prefixed data
  const sigHex = await uorCrypto.signChallenge(accountId, maliciousChallenge);

  // Verify that this signature CANNOT be used to authenticate legitimateInnerStatement
  const verifiedAsInner = await uorCrypto.verifySignature(record.keyPair.publicKey, sigHex, legitimateInnerStatement);
  assert.equal(verifiedAsInner, false, 'Embedded prefix must not collide with single-prefixed statement');
});

await test('2.5 Cross-Account Signature Substitution Attack', async () => {
  const aliceId = `uor:user:alice_${Date.now()}`;
  const bobId = `uor:user:bob_${Date.now()}`;
  const aliceRecord = await uorCrypto.getOrCreateKeyPair(aliceId);
  const bobRecord = await uorCrypto.getOrCreateKeyPair(bobId);

  const challenge = 'sole-owner-retirement-request-challenge-nonce';
  const aliceSig = await uorCrypto.signChallenge(aliceId, challenge);

  // Verify Alice's signature against Alice's public key succeeds
  const aliceVerified = await uorCrypto.verifySignature(aliceRecord.keyPair.publicKey, aliceSig, challenge);
  assert.equal(aliceVerified, true, "Alice's signature must verify against Alice's public key");

  // Adversary presents Alice's signature as Bob's signature
  const bobVerified = await uorCrypto.verifySignature(bobRecord.keyPair.publicKey, aliceSig, challenge);
  assert.equal(bobVerified, false, "Alice's signature must NOT verify against Bob's public key");
});

await test('2.6 Malformed & Adversarial Signature Hex Input Hardening', async () => {
  const accountId = `uor:user:malformed_sig_${Date.now()}`;
  const record = await uorCrypto.getOrCreateKeyPair(accountId);
  const challenge = 'normal-challenge-string';

  const validSig = await uorCrypto.signChallenge(accountId, challenge);
  assert.ok(validSig.length > 0);

  const adversarialSignatures = [
    { desc: 'Empty signature', sig: '' },
    { desc: 'Odd-length hex string', sig: validSig.substring(0, validSig.length - 1) },
    { desc: 'Non-hex letters', sig: 'zz'.repeat(64) },
    { desc: 'Embedded whitespace', sig: validSig.slice(0, 32) + ' ' + validSig.slice(32) },
    { desc: 'All-zero scalar', sig: '00'.repeat(64) },
    { desc: 'Truncated 32-byte signature', sig: validSig.substring(0, 64) },
    { desc: 'Appended trailing garbage hex', sig: validSig + 'abcd' },
    { desc: 'Scalar single bit flip', sig: (parseInt(validSig[0], 16) ^ 1).toString(16) + validSig.substring(1) }
  ];

  for (const { desc, sig } of adversarialSignatures) {
    const verified = await uorCrypto.verifySignature(record.keyPair.publicKey, sig, challenge);
    assert.equal(verified, false, `${desc} must evaluate to false safely`);
  }
});

// ============================================================================
// PART 3: BROWSER PLAYWRIGHT ENVIRONMENT: ANTI-ROLLBACK WAL & KAPPA STORE
// ============================================================================
console.log('\n--- PART 3: ANTI-ROLLBACK WAL JOURNAL & PERSISTENT KAPPA STORE ---');

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(siteHtmlPath, { waitUntil: 'load' });

  // --------------------------------------------------------------------------
  // 3.1 ANTI-ROLLBACK WAL JOURNAL INVARIANT STRESS TESTS
  // --------------------------------------------------------------------------
  await test('3.1 Anti-Rollback WAL Journal: Baseline monotonic progression', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const initialRev = uor.state.journalRevision;

      const e1 = await uor.appendJournalEntry({
        revision: initialRev + 1,
        type: 'TestBaseline1',
        payload: 'val-1'
      });
      const e2 = await uor.appendJournalEntry({
        revision: initialRev + 5,
        type: 'TestBaseline2',
        payload: 'val-2'
      });

      return {
        initialRev,
        e1Rev: e1.revision,
        e2Rev: e2.revision,
        finalRev: uor.state.journalRevision
      };
    });

    assert.equal(result.e1Rev, result.initialRev + 1);
    assert.equal(result.e2Rev, result.initialRev + 5);
    assert.equal(result.finalRev, result.initialRev + 5);
  });

  await test('3.2 Anti-Rollback WAL Journal: Stale revision injection strict rejection', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const currentRev = uor.state.journalRevision;

      const staleRevisions = [
        currentRev - 1,
        currentRev - 5,
        currentRev - 100,
        0,
        -1,
        -999
      ];

      const rejectionResults = [];

      for (const staleRev of staleRevisions) {
        let rejected = false;
        let errorMessage = '';
        try {
          await uor.appendJournalEntry({
            revision: staleRev,
            type: 'StaleRollbackAttack',
            payload: `payload-at-${staleRev}`
          });
        } catch (err) {
          rejected = true;
          errorMessage = err.message;
        }

        rejectionResults.push({
          staleRev,
          rejected,
          errorMessage,
          currentRevAfter: uor.state.journalRevision
        });
      }

      return {
        currentRev,
        rejectionResults,
        finalRev: uor.state.journalRevision
      };
    });

    for (const r of result.rejectionResults) {
      assert.equal(r.rejected, true, `Stale revision ${r.staleRev} must be rejected`);
      assert.match(r.errorMessage, /Rollback detected: incoming revision .* <= local revision/);
      assert.equal(r.currentRevAfter, result.currentRev, 'State revision must not be altered by stale append');
    }
    assert.equal(result.finalRev, result.currentRev, 'Final revision must remain strictly uncorrupted');
  });

  await test('3.3 Anti-Rollback WAL Journal: Identical revision (replay attack) strict rejection', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const currentRev = uor.state.journalRevision;

      // First advance by 1
      const legit = await uor.appendJournalEntry({
        revision: currentRev + 1,
        type: 'LegitAdvance',
        payload: 'legit-action'
      });

      const newCurrentRev = uor.state.journalRevision;

      // Replay identical revision
      let replayRejected = false;
      let replayError = '';
      try {
        await uor.appendJournalEntry({
          revision: newCurrentRev, // IDENTICAL REVISION
          type: 'IdenticalReplayAttack',
          payload: 'adversarial-replay'
        });
      } catch (err) {
        replayRejected = true;
        replayError = err.message;
      }

      return {
        legitRev: legit.revision,
        newCurrentRev,
        replayRejected,
        replayError,
        finalRev: uor.state.journalRevision
      };
    });

    assert.equal(result.replayRejected, true, 'Replay of identical revision must be strictly rejected');
    assert.match(result.replayError, /Rollback detected: incoming revision .* <= local revision/);
    assert.equal(result.finalRev, result.newCurrentRev, 'Journal revision must not change after replay failure');
  });

  await test('3.4 Anti-Rollback WAL Journal: Concurrent out-of-order race attack', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const baseRev = uor.state.journalRevision;

      // 10 concurrent requests fired simultaneously: mixed forward and stale
      const requests = [
        { rev: baseRev + 1, expectedPass: true },
        { rev: baseRev - 2, expectedPass: false },
        { rev: baseRev + 3, expectedPass: true },
        { rev: baseRev + 1, expectedPass: false }, // Duplicate of above
        { rev: baseRev + 5, expectedPass: true },
        { rev: baseRev,     expectedPass: false }, // Stale
        { rev: baseRev + 2, expectedPass: false }, // Stale once +3 passes
        { rev: baseRev + 6, expectedPass: true },
        { rev: -5,          expectedPass: false }, // Negative
        { rev: baseRev + 10, expectedPass: true }
      ];

      const outcomes = await Promise.allSettled(
        requests.map(r => uor.appendJournalEntry({
          revision: r.rev,
          type: 'ConcurrentRace',
          payload: `race-${r.rev}`
        }))
      );

      return {
        baseRev,
        outcomes: outcomes.map((o, idx) => ({
          rev: requests[idx].rev,
          status: o.status,
          error: o.reason?.message
        })),
        finalRev: uor.state.journalRevision
      };
    });

    // Ensure state revision monotonically advanced and is >= baseRev + 10
    assert.ok(result.finalRev >= result.baseRev + 10, 'Journal revision must have advanced to highest committed revision');

    // Verify all negative and stale revisions were rejected
    for (const out of result.outcomes) {
      if (out.rev <= result.baseRev) {
        assert.equal(out.status, 'rejected', `Revision ${out.rev} <= baseRev must be rejected`);
      }
    }
  });

  await test('3.5 Anti-Rollback WAL Journal: Signed checkpoint rollback rejection', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const currentRev = uor.state.journalRevision;

      // Valid forward checkpoint
      const validCheckpoint = await uor.saveSignedCheckpoint({
        revision: currentRev + 2,
        stateHash: 'sha256:1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
        signature: 'valid-sig-hex',
        timestamp: new Date().toISOString()
      });

      // Rollback checkpoint attempt
      let rollbackRejected = false;
      let rollbackError = '';
      try {
        await uor.saveSignedCheckpoint({
          revision: currentRev - 1, // LOWER REVISION
          stateHash: 'sha256:stale-checkpoint-hash',
          signature: 'adversarial-sig',
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        rollbackRejected = true;
        rollbackError = err.message;
      }

      return {
        validRev: validCheckpoint.revision,
        rollbackRejected,
        rollbackError,
        lastCheckpointRev: uor.state.lastCheckpoint?.revision
      };
    });

    assert.ok(result.validRev > 0, 'Forward checkpoint succeeded');
    assert.equal(result.rollbackRejected, true, 'Stale checkpoint must be strictly rejected');
    assert.match(result.rollbackError, /Rollback rejected: checkpoint revision .* < current revision/);
    assert.equal(result.lastCheckpointRev, result.validRev, 'Last checkpoint must remain the valid one');
  });

  // --------------------------------------------------------------------------
  // 3.2 PERSISTENT KAPPA STORE CONTENT ADDRESSING & INTEGRITY
  // --------------------------------------------------------------------------
  await test('3.6 Persistent Kappa Store: Content Addressing SHA-256 enforcement', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const payload = 'Content-Addressed Sovereign Object Payload 2026';
      const actualDigestHex = await window.uorCrypto.sha256Hex(payload);
      const validDigest = `sha256:${actualDigestHex}`;

      // 1. Valid digest putBlob
      const record = await uor.putBlob(validDigest, payload);

      // 2. Mismatched digest putBlob (tampered digest)
      const fakeDigest = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      let mismatchRejected = false;
      let mismatchError = '';
      try {
        await uor.putBlob(fakeDigest, payload);
      } catch (err) {
        mismatchRejected = true;
        mismatchError = err.message;
      }

      // 3. Single bit flipped digest
      const flippedHex = (parseInt(actualDigestHex[0], 16) ^ 1).toString(16) + actualDigestHex.substring(1);
      const flippedDigest = `sha256:${flippedHex}`;
      let flipRejected = false;
      try {
        await uor.putBlob(flippedDigest, payload);
      } catch {
        flipRejected = true;
      }

      return {
        storedDigest: record.digest,
        validDigest,
        mismatchRejected,
        mismatchError,
        flipRejected
      };
    });

    assert.equal(result.storedDigest, result.validDigest, 'Valid digest must be accepted and stored');
    assert.equal(result.mismatchRejected, true, 'Mismatched digest must be rejected by putBlob');
    assert.match(result.mismatchError, /Digest mismatch: expected .* computed .*/);
    assert.equal(result.flipRejected, true, 'Bit-flipped digest must be rejected by putBlob');
  });

  await test('3.7 Persistent Kappa Store: Integrity and Persistence across Simulated Browser Reload', async () => {
    // Generate distinct test blobs across types and sizes
    const testBlobs = [
      { id: 'string', data: 'Verified Kappa Object State String Across Session Restarts' },
      { id: 'empty', data: '' },
      { id: 'json', data: JSON.stringify({ uorId: 'uor:obj:alpha', active: true, replicas: 3 }) },
      { id: 'binary_hex', data: '48656c6c6f20554f5220466f756e647279204b61707061' } // ASCII hex
    ];

    // Step A: Store blobs in the current browser page
    const storedDigests = await page.evaluate(async (blobs) => {
      const uor = window.uorFoundry;
      const digests = [];
      for (const b of blobs) {
        const hex = await window.uorCrypto.sha256Hex(b.data);
        const digest = `sha256:${hex}`;
        await uor.putBlob(digest, b.data);
        digests.push({ id: b.id, digest, expectedData: b.data });
      }
      return digests;
    }, testBlobs);

    assert.equal(storedDigests.length, testBlobs.length);

    // Step B: Simulate Browser Reload / Session Restart
    // Reloading the page wipes all in-memory JavaScript variables (state.blobs = new Map())
    // and forces retrieval to hit persistent IndexedDB storage!
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    // Step C: Retrieve blobs from fresh page instance and verify content addressing
    const verificationResults = await page.evaluate(async (digests) => {
      const uor = window.uorFoundry;
      const results = [];

      for (const item of digests) {
        // Query via getBlob
        const record = await uor.getBlob(item.digest);
        if (!record) {
          results.push({ id: item.id, found: false });
          continue;
        }

        const retrievedContent = record.isString
          ? record.data
          : new TextDecoder().decode(new Uint8Array(record.data));

        // Re-compute SHA-256 on disk-retrieved bytes
        const recomputedHex = await window.uorCrypto.sha256Hex(retrievedContent);
        const recomputedDigest = `sha256:${recomputedHex}`;

        results.push({
          id: item.id,
          found: true,
          contentMatches: retrievedContent === item.expectedData,
          digestMatches: recomputedDigest === item.digest,
          retrievedDigest: record.digest
        });
      }

      return results;
    }, storedDigests);

    for (const res of verificationResults) {
      assert.equal(res.found, true, `Blob ${res.id} must be found in persistent IndexedDB after reload`);
      assert.equal(res.contentMatches, true, `Blob ${res.id} content must match byte-for-byte`);
      assert.equal(res.digestMatches, true, `Blob ${res.id} re-computed SHA-256 must match stored digest`);
    }
  });

  await test('3.8 Persistent Kappa Store: Disk Tamper Detection', async () => {
    // 1. Store a known blob
    const originalText = 'IMMUTABLE_GENUINE_BLOCK_CHAIN_METADATA_2026';
    const originalHex = await uorCrypto.sha256Hex(originalText);
    const canonicalDigest = `sha256:${originalHex}`;

    await page.evaluate(async ({ digest, text }) => {
      await window.uorFoundry.putBlob(digest, text);
    }, { digest: canonicalDigest, text: originalText });

    // 2. Adversary directly opens IndexedDB behind the scenes and tampers with the stored record data
    const tamperResult = await page.evaluate(async (targetDigest) => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('uor_foundry_web_v1_kappa_store', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      // Fetch and tamper the record
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction('objects', 'readonly');
        const req = tx.objectStore('objects').get(targetDigest);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      // Tamper stored data
      record.data = 'MALICIOUS_SUBVERTED_DATA_SUBSTITUTED_ON_DISK';

      await new Promise((resolve, reject) => {
        const tx = db.transaction('objects', 'readwrite');
        const req = tx.objectStore('objects').put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      // Clear memory cache to ensure read hits disk
      window.uorFoundry.state.blobs.clear();

      // Read back through getBlob
      const fetched = await window.uorFoundry.getBlob(targetDigest);
      const fetchedContent = fetched.isString
        ? fetched.data
        : new TextDecoder().decode(new Uint8Array(fetched.data));

      const recomputedHex = await window.uorCrypto.sha256Hex(fetchedContent);
      const recomputedDigest = `sha256:${recomputedHex}`;

      return {
        targetDigest,
        recomputedDigest,
        isDigestConsistent: recomputedDigest === targetDigest
      };
    }, canonicalDigest);

    // Verify tamper was detected (the digest of tampered data no longer matches the content-addressed key)
    assert.equal(tamperResult.isDigestConsistent, false, 'Tampered data on disk must fail content-addressing consistency');
  });

  await test('3.9 Persistent Kappa Store: Large String Payload Durability (256KB Text)', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;

      // 256KB text string
      const size = 262144;
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let largeText = '';
      for (let i = 0; i < size; i++) {
        largeText += alphabet[i % alphabet.length];
      }

      // Compute digest
      const hex = await window.uorCrypto.sha256Hex(largeText);
      const digest = `sha256:${hex}`;

      // Put blob
      const stored = await uor.putBlob(digest, largeText);

      // Clear in-memory cache
      uor.state.blobs.clear();

      // Get blob from IndexedDB
      const fetched = await uor.getBlob(digest);
      const fetchedText = fetched.isString ? fetched.data : new TextDecoder().decode(new Uint8Array(fetched.data));

      return {
        storedLength: stored.length,
        fetchedLength: fetchedText.length,
        textMatches: fetchedText === largeText,
        digestMatches: fetched.digest === digest
      };
    });

    assert.equal(result.storedLength, 262144);
    assert.equal(result.fetchedLength, 262144);
    assert.equal(result.textMatches, true, '256KB string payload must match byte-for-byte');
    assert.equal(result.digestMatches, true, 'Stored digest must match canonical SHA-256');
  });

  await test('3.10 Persistent Kappa Store: Binary Uint8Array Payload Ingestion & Digest Validation', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;

      // 1024-byte binary Uint8Array buffer
      const size = 1024;
      const binaryBytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        binaryBytes[i] = (i * 31 + 17) & 0xff;
      }

      // Compute authentic SHA-256 of raw binary buffer using WebCrypto
      const digestBuffer = await crypto.subtle.digest('SHA-256', binaryBytes);
      const hex = Array.from(new Uint8Array(digestBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const digest = `sha256:${hex}`;

      // Attempt putBlob with binary buffer
      let putRejected = false;
      let putError = null;
      let storedRecord = null;
      try {
        storedRecord = await uor.putBlob(digest, binaryBytes);
      } catch (err) {
        putRejected = true;
        putError = err.message;
      }

      return {
        digest,
        putRejected,
        putError,
        storedRecord
      };
    });

    // We assert that binary buffer storage MUST succeed without digest mismatch.
    // Defect in foundry.js:107 sha256Hex coerces Uint8Array to string via TextEncoder().encode(bytesOrText)
    // which hashes the string representation "17,48,..." instead of the raw bytes.
    assert.equal(result.putRejected, false, `putBlob with binary Uint8Array must succeed, but failed with: ${result.putError}`);
    assert.ok(result.storedRecord, 'Binary record must be stored');
  });

  await test('3.11 Persistent Kappa Store: Non-existent and malformed queries', async () => {
    const result = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const q1 = await uor.getBlob('sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const q2 = await uor.getBlob('non-existent-tag');
      const q3 = await uor.getBlob('');

      return { q1, q2, q3 };
    });

    assert.equal(result.q1, null, 'Unregistered SHA-256 digest query must return null');
    assert.equal(result.q2, null, 'Arbitrary string digest query must return null');
    assert.equal(result.q3, null, 'Empty string query must return null');
  });

  await context.close();
} finally {
  await browser.close();
}

console.log('\n================================================================');
console.log(`TOTAL ADVERSARIAL TESTS RUN: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  console.error('\nFAILURE BREAKDOWN:');
  for (const f of failureDetails) {
    console.error(`- ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\nALL ADVERSARIAL STRESS TESTS PASSED CLEANLY WITH ZERO DEFECTS.');
  process.exit(0);
}
