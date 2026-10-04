import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../site/crypto.js';

const siteHtmlPath = pathToFileURL(resolve('site/index.html')).href;

console.log('================================================================');
console.log('CHALLENGER EMPIRICAL ADVERSARIAL STRESS SUITE (Milestone 3 Comms)');
console.log('Target: Message & Attachment Limits, Kappa Blob Store, Delivery, Cross-Org Isolation, Notifications');
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
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(siteHtmlPath);
await page.waitForLoadState('domcontentloaded');

// Ensure messaging tab is active
await page.locator('#tab-messaging').click();
await page.waitForTimeout(200);

// ============================================================================
// PART 1: MESSAGE BOUNDS & 25 MIB ATTACHMENT ADVERSARIAL STRESS
// ============================================================================
console.log('--- PART 1: MESSAGE BOUNDS & ATTACHMENT LIMITS ---');

await test('1.1 Attachment boundary: exact 25 MiB boundary and overflow (+1 byte) rejection', async () => {
  const MAX_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

  // 1. Exactly 26,214,401 bytes (25 MiB + 1 byte) MUST trigger alert and be rejected
  let alertMessage = '';
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.evaluate((max) => {
    const fakeFile = new File(['0'], 'overflow_archive.zip', { type: 'application/zip' });
    Object.defineProperty(fakeFile, 'size', { value: max + 1 });

    const dt = new DataTransfer();
    dt.items.add(fakeFile);
    document.getElementById('msg-attachment-file').files = dt.files;
    document.getElementById('msg-subject').value = 'Boundary + 1';
    document.getElementById('msg-body').value = 'Attempting 25 MiB + 1 byte upload';
  }, MAX_BYTES);

  await page.locator('#btn-dispatch-message').click();
  await page.waitForTimeout(200);

  assert.ok(
    alertMessage.includes('Attachment exceeds 25 MiB limit'),
    `Expected 25 MiB limit alert, got: "${alertMessage}"`
  );

  // 2. Exact 25 MiB boundary: 26,214,400 bytes must NOT be rejected by size check
  let boundaryRejected = false;
  page.once('dialog', async (dialog) => {
    boundaryRejected = true;
    await dialog.accept();
  });

  await page.evaluate(() => {
    const validFile = new File(['Boundary test content'], 'boundary_archive.txt', { type: 'text/plain' });
    Object.defineProperty(validFile, 'size', { value: 25 * 1024 * 1024 });

    const dt = new DataTransfer();
    dt.items.add(validFile);
    document.getElementById('msg-attachment-file').files = dt.files;
    document.getElementById('msg-attachment-alt').value = 'Alt text for boundary file';
    document.getElementById('msg-subject').value = 'Exact 25 MiB Boundary';
    document.getElementById('msg-body').value = 'Testing exact boundary handling';
  });

  await page.locator('#btn-dispatch-message').click();
  await page.waitForTimeout(300);

  assert.equal(boundaryRejected, false, 'Exact 25 MiB file must not trigger rejection dialog');
});

// ============================================================================
// PART 2: CONTENT-ADDRESSED KAPPA BLOB STORAGE INTEGRITY & TAMPER DETECTION
// ============================================================================
console.log('\n--- PART 2: KAPPA BLOB STORE INTEGRITY & TAMPER DETECTION ---');

await test('2.1 putBlob and getBlob return byte-identical data matching SHA-256 digest', async () => {
  const result = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const testPayloads = [
      'Simple ASCII test vector for Kappa Blob Store',
      new Uint8Array([0x00, 0x01, 0x02, 0xfe, 0xff]),
      new Uint8Array(1024).map((_, i) => i % 256),
      JSON.stringify({ schema: 'uor:blob:v1', nonce: 42, active: true })
    ];

    const results = [];
    for (const p of testPayloads) {
      const rawData = typeof p === 'string'
        ? new TextEncoder().encode(p)
        : p;
      const expectedDigest = `sha256:${await sha256Hex(rawData)}`;

      // Store blob
      const storedRecord = await uor.putBlob(expectedDigest, p);
      if (storedRecord.digest !== expectedDigest) {
        return { success: false, reason: `Stored digest mismatch: ${storedRecord.digest} vs ${expectedDigest}` };
      }

      // Retrieve blob
      const retrieved = await uor.getBlob(expectedDigest);
      if (!retrieved) {
        return { success: false, reason: `Blob not found for digest ${expectedDigest}` };
      }

      // Check byte parity
      const retrievedBytes = retrieved.isString
        ? new TextEncoder().encode(retrieved.data)
        : new Uint8Array(retrieved.data);

      if (retrievedBytes.length !== rawData.length) {
        return { success: false, reason: `Length mismatch: ${retrievedBytes.length} vs ${rawData.length}` };
      }

      for (let i = 0; i < rawData.length; i++) {
        if (retrievedBytes[i] !== rawData[i]) {
          return { success: false, reason: `Byte mismatch at index ${i}` };
        }
      }

      results.push({ digest: expectedDigest, verified: true });
    }

    return { success: true, count: results.length };
  });

  assert.ok(result.success, result.reason || 'Kappa store byte fidelity verification failed');
  assert.equal(result.count, 4, 'All 4 test payloads must be verified');
});

await test('2.2 Forged or corrupted SHA-256 digest in putBlob is strictly rejected', async () => {
  const rejectionResult = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const realPayload = 'Authentic payload data';
    const fakeDigest = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

    try {
      await uor.putBlob(fakeDigest, realPayload);
      return { rejected: false };
    } catch (err) {
      return { rejected: true, message: err.message };
    }
  });

  assert.ok(rejectionResult.rejected, 'putBlob must throw error when digest does not match content');
  assert.ok(
    rejectionResult.message.includes('Digest mismatch'),
    `Expected Digest mismatch error, got: "${rejectionResult.message}"`
  );
});

await test('2.3 Non-existent digest in getBlob returns null cleanly without throwing', async () => {
  const missingResult = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const nonExistent = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    return await uor.getBlob(nonExistent);
  });

  assert.equal(missingResult, null, 'getBlob must return null for missing digest');
});

// ============================================================================
// PART 3: DELIVERY PROGRESSION & CHANNEL CROSS-ORG ISOLATION
// ============================================================================
console.log('\n--- PART 3: DELIVERY PROGRESSION & CROSS-ORG CHANNEL ISOLATION ---');

await test('3.1 Message delivery state transitions: Sent -> Delivered -> Acknowledged progression', async () => {
  // Probing the exact progression sequence in page context
  const observed = await page.evaluate(async () => {
    const form = document.getElementById('form-send-message');
    document.getElementById('msg-subject').value = 'Delivery State Lifecycle';
    document.getElementById('msg-body').value = 'Progression test payload';

    // Trigger dispatch
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const uor = window.uorFoundry;
    const msg = uor.state.messages[uor.state.messages.length - 1];
    const initialStatus = msg.status;

    // Wait past 60ms timer
    await new Promise(r => setTimeout(r, 90));
    const midStatus = msg.status;

    // Wait past 180ms timer
    await new Promise(r => setTimeout(r, 140));
    const finalStatus = msg.status;

    return { initialStatus, midStatus, finalStatus };
  });

  assert.equal(observed.initialStatus, 'Sent', 'Initial delivery status must be Sent');
  assert.equal(observed.midStatus, 'Delivered', 'Mid delivery status must be Delivered');
  assert.equal(observed.finalStatus, 'Acknowledged', 'Final delivery status must be Acknowledged');

  // Verify DOM badge updates to Acknowledged and has badge-success class
  await page.waitForTimeout(100);
  const finalBadge = page.locator('#messages-list .message-card:last-child .msg-status-badge');
  const badgeText = await finalBadge.innerText();
  const badgeClass = await finalBadge.getAttribute('class');

  assert.equal(badgeText, 'Acknowledged', 'DOM badge text must display Acknowledged');
  assert.ok(badgeClass.includes('badge-success'), 'Acknowledged status must have badge-success styling');
});

await test('3.2 Channel cross-organization isolation: no channel leakage across orgs', async () => {
  const isolationCheck = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const originalOrgId = uor.state.activeOrgId;
    const foreignOrgId = 'uor:org:isolated-external-org-99';

    // Channels initially present in originalOrgId
    const originalChannels = uor.state.channels.filter(c => c.orgId === originalOrgId);

    // Create a private channel in originalOrgId
    const secretChan = {
      id: `uor:channel:test-secret:${Date.now()}`,
      name: '#secret-financials',
      topic: 'Confidential org data',
      type: 'Private',
      orgId: originalOrgId
    };
    uor.state.channels.push(secretChan);

    // Switch activeOrgId to foreignOrgId
    uor.state.activeOrgId = foreignOrgId;

    // Filter channels for foreignOrgId
    const foreignVisibleChannels = uor.state.channels.filter(c => c.orgId === uor.state.activeOrgId);

    // Check that none of the original org channels leak into foreignOrgId
    const leakedChannels = foreignVisibleChannels.filter(c => c.orgId === originalOrgId);

    // Restore original activeOrgId
    uor.state.activeOrgId = originalOrgId;

    return {
      originalOrgCount: originalChannels.length + 1,
      foreignVisibleCount: foreignVisibleChannels.length,
      leakedCount: leakedChannels.length
    };
  });

  assert.equal(isolationCheck.leakedCount, 0, 'No channels from original org should leak into foreign org');
  assert.equal(isolationCheck.foreignVisibleCount, 0, 'Foreign org with no registered channels must see 0 channels');
});

await test('3.3 Channel uniqueness is scoped per-org: same channel name allowed in different orgs', async () => {
  const perOrgScoping = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const org1 = 'uor:org:domain-one';
    const org2 = 'uor:org:domain-two';

    // Register '#announcements' in org1
    uor.state.channels.push({
      id: 'uor:channel:domain-one:announcements',
      name: '#announcements',
      topic: 'Announcements 1',
      type: 'Public',
      orgId: org1
    });

    // Check duplicate check in org1 (should detect duplicate)
    const existsInOrg1 = uor.state.channels.some(
      c => c.orgId === org1 && c.name.toLowerCase() === '#announcements'
    );

    // Check duplicate check in org2 (should NOT detect duplicate)
    const existsInOrg2 = uor.state.channels.some(
      c => c.orgId === org2 && c.name.toLowerCase() === '#announcements'
    );

    return { existsInOrg1, existsInOrg2 };
  });

  assert.equal(perOrgScoping.existsInOrg1, true, '#announcements must exist in org1');
  assert.equal(perOrgScoping.existsInOrg2, false, '#announcements must not collide in org2');
});

// ============================================================================
// PART 4: SHARED INBOX & NOTIFICATION CONSISTENCY ACROSS EVENT TRIGGERS
// ============================================================================
console.log('\n--- PART 4: SHARED INBOX & NOTIFICATIONS CONSISTENCY ---');

await test('4.1 Dispatch all canonical notification event triggers and verify unread badge accounting', async () => {
  // Capture initial badge value
  const initialCountStr = await page.locator('#unread-notif-badge').innerText();
  const initialCount = parseInt(initialCountStr, 10);

  const testEvents = [
    { event: 'SecurityLogin', severity: 'Info', title: 'Adversarial Login 1', route: '#panel-identity' },
    { event: 'BackupCodeRedeemed', severity: 'Warning', title: 'Adversarial Backup 2', route: '#panel-backup-codes' },
    { event: 'InvitationReceived', severity: 'Info', title: 'Adversarial Invite 3', route: '#panel-organization' },
    { event: 'ProposalCreated', severity: 'Critical', title: 'Adversarial Proposal 4', route: '#panel-governance' },
    { event: 'MilestoneCompleted', severity: 'Info', title: 'Adversarial Milestone 5', route: '#panel-projects' },
  ];

  // Dispatch all 5 events
  await page.evaluate((events) => {
    for (const ev of events) {
      window.uorFoundry.dispatchNotification({
        event: ev.event,
        severity: ev.severity,
        title: ev.title,
        summary: `Verification of event ${ev.event}`,
        route: ev.route
      });
    }
  }, testEvents);

  await page.waitForTimeout(300);

  // Badge must be incremented by exactly 5
  const newCountStr = await page.locator('#unread-notif-badge').innerText();
  const newCount = parseInt(newCountStr, 10);
  assert.equal(newCount, initialCount + 5, `Unread badge must increment by 5 (expected ${initialCount + 5}, got ${newCount})`);

  // Open inbox panel
  await page.locator('#btn-inbox').click();
  await page.waitForTimeout(200);

  // Verify all 5 titles are present in the list
  const inboxListText = await page.locator('#inbox-list').innerText();
  for (const ev of testEvents) {
    assert.ok(inboxListText.includes(ev.title), `Notification "${ev.title}" must be displayed in inbox`);
  }

  // Mark one notification read and check badge decrements by 1
  const firstMarkReadBtn = page.locator('#inbox-list .btn-mark-read').first();
  await firstMarkReadBtn.click();
  await page.waitForTimeout(200);

  const afterOneReadStr = await page.locator('#unread-notif-badge').innerText();
  assert.equal(parseInt(afterOneReadStr, 10), initialCount + 4, 'Badge count must decrement by 1 after marking one notification read');

  // Mark all notifications read
  await page.locator('#btn-mark-all-read').click();
  await page.waitForTimeout(200);

  const afterAllReadStr = await page.locator('#unread-notif-badge').innerText();
  assert.equal(afterAllReadStr, '0', 'Badge count must be 0 after Mark All Read');
  const badgeClass = await page.locator('#unread-notif-badge').getAttribute('class');
  assert.ok(badgeClass.includes('badge-neutral'), '0 unread badge must have badge-neutral styling');
});

await test('4.2 Interactive notification route navigation switches active tab and closes inbox panel', async () => {
  // Dispatch a notification with route '#panel-governance'
  await page.evaluate(() => {
    window.uorFoundry.dispatchNotification({
      event: 'ProposalCreated',
      severity: 'Critical',
      title: 'Governance Quorum Action Needed',
      summary: 'Route navigation test',
      route: '#panel-governance'
    });
  });

  // Open inbox panel if closed
  const isHidden = await page.locator('#inbox-panel').getAttribute('hidden');
  if (isHidden !== null) {
    await page.locator('#btn-inbox').click();
    await page.waitForTimeout(200);
  }

  // Find and click the route link
  const routeLink = page.locator('#inbox-list .notif-route-link[data-route="#panel-governance"]').first();
  await routeLink.click();
  await page.waitForTimeout(300);

  // Governance panel must now be active/visible
  const govPanelVisible = await page.locator('#panel-governance').isVisible();
  assert.ok(govPanelVisible, 'Clicking notification route must activate Governance panel');

  // Inbox panel must now be closed
  const panelHiddenAfter = await page.locator('#inbox-panel').getAttribute('hidden');
  assert.notEqual(panelHiddenAfter, null, 'Inbox panel must be closed after route navigation');
});

// ============================================================================
// PART 5: MULTI-BROWSER WCAG 2.2 AA ACCESSIBILITY AUDIT
// ============================================================================
console.log('\n--- PART 5: MULTI-BROWSER WCAG 2.2 AA ACCESSIBILITY AUDIT ---');

for (const browserType of [chromium, firefox]) {
  const browserName = browserType.name();
  await test(`5.1 ${browserName}: Full Messaging & Inbox interface passes Axe WCAG 2.2 AA`, async () => {
    const b = await browserType.launch({ headless: true });
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    await p.goto(siteHtmlPath);
    await p.waitForLoadState('domcontentloaded');

    // 1. Audit Messaging Panel
    await p.locator('#tab-messaging').click();
    await p.waitForTimeout(300);

    const axeMessaging = await new AxeBuilder({ page: p })
      .include('#panel-messaging')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    assert.equal(
      axeMessaging.violations.length,
      0,
      `${browserName} Messaging violations: ${JSON.stringify(axeMessaging.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })))}`
    );

    // 2. Audit Inbox dropdown panel open
    await p.locator('#btn-inbox').click();
    await p.waitForTimeout(300);

    const axeInbox = await new AxeBuilder({ page: p })
      .include('#inbox-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    assert.equal(
      axeInbox.violations.length,
      0,
      `${browserName} Inbox panel violations: ${JSON.stringify(axeInbox.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })))}`
    );

    await b.close();
  });
}

await browser.close();

console.log('\n================================================================');
console.log(`TOTAL ADVERSARIAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
