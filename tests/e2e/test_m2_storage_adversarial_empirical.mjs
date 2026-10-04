import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import '../../site/crypto.js';

const siteHtmlPath = new URL('../../site/index.html', import.meta.url).href;

console.log('================================================================');
console.log('EMPIRICAL CHALLENGER: DEEP ADVERSARIAL STRESS TEST FOR KAPPA STORAGE & BLOB HASHING');
console.log('Target: CH-M2-01 binary hashing, boundary sizes, concurrent puts, tamper detection');
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
  await page.goto(siteHtmlPath, { waitUntil: 'load' });

  // --------------------------------------------------------------------------
  // TEST 1: Binary Blob Ingestion with 0-byte, 1-byte, and Boundary Buffers
  // --------------------------------------------------------------------------
  await test('E1.1 Binary Ingestion: 0-byte empty Uint8Array', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const emptyBytes = new Uint8Array(0);
      const hash = await crypto.subtle.digest('SHA-256', emptyBytes);
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
      const digest = `sha256:${hex}`;

      const stored = await uor.putBlob(digest, emptyBytes);
      uor.state.blobs.clear();
      const retrieved = await uor.getBlob(digest);
      return {
        storedLength: stored.length,
        retrievedLength: retrieved.length,
        isString: retrieved.isString,
        dataLength: retrieved.data.length
      };
    });

    assert.equal(res.storedLength, 0);
    assert.equal(res.retrievedLength, 0);
    assert.equal(res.isString, false);
    assert.equal(res.dataLength, 0);
  });

  await test('E1.2 Binary Ingestion: 1-byte extreme values (0x00 and 0xFF)', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const results = [];
      for (const val of [0x00, 0xff]) {
        const byteBuf = new Uint8Array([val]);
        const hash = await crypto.subtle.digest('SHA-256', byteBuf);
        const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        const digest = `sha256:${hex}`;

        const stored = await uor.putBlob(digest, byteBuf);
        uor.state.blobs.clear();
        const retrieved = await uor.getBlob(digest);
        results.push({
          val,
          digest,
          storedLen: stored.length,
          retrievedLen: retrieved.length,
          retrievedByte: retrieved.data[0]
        });
      }
      return results;
    });

    for (const r of res) {
      assert.equal(r.storedLen, 1);
      assert.equal(r.retrievedLen, 1);
      assert.equal(r.retrievedByte, r.val);
    }
  });

  await test('E1.3 Binary Ingestion: Raw ArrayBuffer and TypedArray views', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      // ArrayBuffer directly
      const rawBuffer = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]).buffer;
      const hash = await crypto.subtle.digest('SHA-256', rawBuffer);
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
      const digest = `sha256:${hex}`;

      const stored = await uor.putBlob(digest, rawBuffer);
      uor.state.blobs.clear();
      const retrieved = await uor.getBlob(digest);
      return {
        storedLen: stored.length,
        retrievedLen: retrieved.length,
        retrievedBytes: Array.from(retrieved.data)
      };
    });

    assert.equal(res.storedLen, 8);
    assert.equal(res.retrievedLen, 8);
    assert.deepEqual(res.retrievedBytes, [10, 20, 30, 40, 50, 60, 70, 80]);
  });

  await test('E1.4 Binary Ingestion: High-entropy 512KB Buffer Durability', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const size = 524288; // 512 KB
      const bigBuf = new Uint8Array(size);
      // Deterministic PRNG fill
      let seed = 42;
      for (let i = 0; i < size; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        bigBuf[i] = seed & 0xff;
      }

      const hash = await crypto.subtle.digest('SHA-256', bigBuf);
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
      const digest = `sha256:${hex}`;

      const stored = await uor.putBlob(digest, bigBuf);
      uor.state.blobs.clear();
      const retrieved = await uor.getBlob(digest);

      // Verify sample bytes
      const retrievedArr = new Uint8Array(retrieved.data);
      let match = true;
      if (retrievedArr.length !== size) match = false;
      for (let i = 0; i < 1000 && match; i++) {
        const idx = Math.floor((i * 521) % size);
        if (retrievedArr[idx] !== bigBuf[idx]) match = false;
      }

      return {
        storedLen: stored.length,
        retrievedLen: retrieved.length,
        bytesMatch: match,
        digestMatch: retrieved.digest === digest
      };
    });

    assert.equal(res.storedLen, 524288);
    assert.equal(res.retrievedLen, 524288);
    assert.equal(res.bytesMatch, true);
    assert.equal(res.digestMatch, true);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Digest Mismatch and Malformed Inputs Rejection
  // --------------------------------------------------------------------------
  await test('E2.1 Digest Mismatch: Bit-flipped expected digest is rejected', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await crypto.subtle.digest('SHA-256', testBytes);
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
      // Tamper hex
      const tamperedHex = hex.slice(0, -1) + (hex.endsWith('0') ? '1' : '0');
      const tamperedDigest = `sha256:${tamperedHex}`;

      let rejected = false;
      let errMsg = '';
      try {
        await uor.putBlob(tamperedDigest, testBytes);
      } catch (err) {
        rejected = true;
        errMsg = err.message;
      }
      return { rejected, errMsg };
    });

    assert.equal(res.rejected, true);
    assert.match(res.errMsg, /Digest mismatch/);
  });

  await test('E2.2 Digest Parameter Validation: Non-string and empty digests rejected', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const testBytes = new Uint8Array([1, 2, 3]);
      const badInputs = [null, undefined, '', 12345, {}, []];
      const results = [];
      for (const bad of badInputs) {
        let rejected = false;
        try {
          await uor.putBlob(bad, testBytes);
        } catch (err) {
          rejected = true;
        }
        results.push(rejected);
      }
      return results;
    });

    for (const r of res) {
      assert.equal(r, true);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Concurrent Puts & WAL Revision Monotonicity
  // --------------------------------------------------------------------------
  await test('E3.1 Concurrency: 20 simultaneous putBlob operations update WAL monotonically', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const startRev = uor.state.journalRevision;

      // 20 distinct payloads
      const payloads = [];
      for (let i = 0; i < 20; i++) {
        const data = new Uint8Array([i, i * 2, i * 3, i * 4]);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        payloads.push({ digest: `sha256:${hex}`, data });
      }

      const results = await Promise.allSettled(
        payloads.map(p => uor.putBlob(p.digest, p.data))
      );

      const allSuccess = results.every(r => r.status === 'fulfilled');
      const finalRev = uor.state.journalRevision;

      return {
        startRev,
        finalRev,
        allSuccess,
        revDelta: finalRev - startRev
      };
    });

    assert.equal(res.allSuccess, true);
    assert.equal(res.revDelta, 20, 'Each putBlob must monotonically increment journalRevision by 1');
  });

  await test('E3.2 Idempotency: Multiple putBlob calls for identical digest succeed without error', async () => {
    const res = await page.evaluate(async () => {
      const uor = window.uorFoundry;
      const testBytes = new Uint8Array([99, 88, 77, 66]);
      const hash = await crypto.subtle.digest('SHA-256', testBytes);
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
      const digest = `sha256:${hex}`;

      // Put twice
      const r1 = await uor.putBlob(digest, testBytes);
      const r2 = await uor.putBlob(digest, testBytes);

      return {
        r1Digest: r1.digest,
        r2Digest: r2.digest,
        sameDigest: r1.digest === r2.digest
      };
    });

    assert.equal(res.sameDigest, true);
  });

  await context.close();
} finally {
  await browser.close();
}

console.log('\n================================================================');
console.log(`TOTAL EMPIRICAL CHALLENGER TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nALL EMPIRICAL CHALLENGER STRESS TESTS PASSED CLEANLY.');
  process.exit(0);
}
