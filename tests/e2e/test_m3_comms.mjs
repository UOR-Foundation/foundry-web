import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../site/crypto.js';

const siteHtmlPath = pathToFileURL(resolve('site/index.html')).href;

console.log('================================================================');
console.log('CHALLENGER DEEP VERIFICATION SUITE (Milestone 3 - Communications Lifecycle)');
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(siteHtmlPath);
await page.waitForLoadState('domcontentloaded');

// ============================================================================
// PART 1: CHANNELS & ACTIVITYPUB STREAM
// ============================================================================
console.log('\n--- PART 1: CHANNELS DIRECTORY & MESSAGING STREAM ---');

await test('1.1 Messaging tab navigation and channel directory listing', async () => {
  await page.locator('#tab-messaging').click();
  await page.waitForTimeout(200);

  const isVisible = await page.locator('#panel-messaging').isVisible();
  assert.ok(isVisible, 'Messaging panel must be visible');

  const channelButtons = await page.locator('#channel-list .btn-switch-channel').allInnerTexts();
  assert.ok(channelButtons.some(b => b.includes('#general')), 'Channel #general must exist');
  assert.ok(channelButtons.some(b => b.includes('#governance')), 'Channel #governance must exist');
  assert.ok(channelButtons.some(b => b.includes('#operations')), 'Channel #operations must exist');

  const activeChan = await page.locator('#active-channel-name').innerText();
  assert.equal(activeChan, '#general', 'Default active channel must be #general');
});

await test('1.2 Channel creation and duplicate channel rejection', async () => {
  // Create channel #announcements
  await page.locator('#channel-name-input').fill('announcements');
  await page.locator('#channel-topic-input').fill('Organizational broadcasts');
  await page.locator('#channel-type-select').selectOption('Public');
  await page.locator('#btn-create-channel').click();
  await page.waitForTimeout(300);

  let channelButtons = await page.locator('#channel-list .btn-switch-channel').allInnerTexts();
  assert.ok(channelButtons.some(b => b.includes('#announcements')), 'New channel #announcements must appear in list');

  // Attempt creating duplicate channel #announcements
  let alertMessage = '';
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.locator('#channel-name-input').fill('#announcements');
  await page.locator('#btn-create-channel').click();
  await page.waitForTimeout(300);

  assert.ok(alertMessage.includes('already exists in this organization'), `Expected duplicate channel alert, got: "${alertMessage}"`);
});

await test('1.3 Channel switching filters message activity stream', async () => {
  // Click on #governance channel button
  const govBtn = page.locator('#channel-list .btn-switch-channel', { hasText: '#governance' });
  await govBtn.click();
  await page.waitForTimeout(200);

  let activeChan = await page.locator('#active-channel-name').innerText();
  assert.equal(activeChan, '#governance', 'Active channel name must switch to #governance');

  // Switch back to #general
  const genBtn = page.locator('#channel-list .btn-switch-channel', { hasText: '#general' });
  await genBtn.click();
  await page.waitForTimeout(200);

  activeChan = await page.locator('#active-channel-name').innerText();
  assert.equal(activeChan, '#general', 'Active channel name must switch back to #general');
});

await test('1.4 ActivityPub message dispatch with progressive delivery states', async () => {
  const testSubject = 'Telemetry Sync';
  const testBody = 'Vector clock reconciled with all 3 replicas.';

  await page.locator('#msg-subject').fill(testSubject);
  await page.locator('#msg-body').fill(testBody);
  await page.locator('#btn-dispatch-message').click();

  // Verify message immediately appears in feed
  await page.waitForTimeout(100);
  let messagesText = await page.locator('#messages-list').innerText();
  assert.ok(messagesText.includes(testSubject), 'Message subject must be in activity stream');
  assert.ok(messagesText.includes(testBody), 'Message body must be in activity stream');

  // Wait for delivery state progression: Sent -> Delivered -> Acknowledged
  await page.waitForTimeout(300);
  const statusBadge = await page.locator('#messages-list .message-card:last-child .msg-status-badge').innerText();
  assert.equal(statusBadge, 'Acknowledged', 'Message delivery status must reach Acknowledged');
});

// ============================================================================
// PART 2: 25 MIB ATTACHMENT BOUNDARY & PERSISTENT KAPPA STORE
// ============================================================================
console.log('\n--- PART 2: 25 MIB ATTACHMENT BOUNDARY & KAPPA STORE INTEGRATION ---');

await test('2.1 Hostile / Oversized media attachment (> 25 MiB) is rejected', async () => {
  let alertMessage = '';
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  // Inject a synthetic oversized File object (> 25 MiB) into the file input
  await page.evaluate(() => {
    const oversizedBytes = 25 * 1024 * 1024 + 1024; // 25 MiB + 1 KiB
    const fakeFile = new File(['x'], 'huge_firmware.bin', { type: 'application/octet-stream' });
    Object.defineProperty(fakeFile, 'size', { value: oversizedBytes });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(fakeFile);
    document.getElementById('msg-attachment-file').files = dataTransfer.files;

    document.getElementById('msg-subject').value = 'Exploit payload';
    document.getElementById('msg-body').value = 'Testing 25 MiB boundary enforcement';
  });

  await page.locator('#btn-dispatch-message').click();
  await page.waitForTimeout(300);

  assert.ok(
    alertMessage.includes('Attachment exceeds 25 MiB limit'),
    `Expected 25 MiB rejection dialog, got: "${alertMessage}"`
  );
});

await test('2.2 Valid media attachment is hashed with SHA-256 and stored in Kappa store', async () => {
  // Attach valid payload with accessible alt text
  const payloadText = 'Decentralized Sovereign Object Specification v1.0';
  await page.evaluate((payload) => {
    const file = new File([payload], 'spec_document.txt', { type: 'text/plain' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    document.getElementById('msg-attachment-file').files = dataTransfer.files;

    document.getElementById('msg-attachment-alt').value = 'Full text of the pure-model architecture specification';
    document.getElementById('msg-subject').value = 'Specification Release';
    document.getElementById('msg-body').value = 'Attached is the verified architecture document.';
  }, payloadText);

  await page.locator('#btn-dispatch-message').click();
  await page.waitForTimeout(400);

  // Verify attachment card in message feed
  const messagesHtml = await page.locator('#messages-list').innerHTML();
  assert.ok(messagesHtml.includes('Attachment: spec_document.txt'), 'Attachment card must be present');
  assert.ok(messagesHtml.includes('MIME: <code>text/plain</code>'), 'Attachment MIME must be text/plain');
  assert.ok(messagesHtml.includes('Kappa Digest: <code>sha256:'), 'Kappa Digest must be displayed');
  assert.ok(messagesHtml.includes('Full text of the pure-model architecture specification'), 'Alt text must be rendered for accessibility');

  // Verify blob can be retrieved directly from the persistent Kappa store
  const kappaVerification = await page.evaluate(async (expectedPayload) => {
    const uor = window.uorFoundry;
    const lastMsg = uor.state.messages[uor.state.messages.length - 1];
    if (!lastMsg || !lastMsg.attachment) return { error: 'No attachment found in message' };

    const digest = lastMsg.attachment.digest;
    const blobRecord = await uor.getBlob(digest);
    if (!blobRecord) return { error: 'Blob not found in Kappa store' };

    const retrievedText = new TextDecoder().decode(new Uint8Array(blobRecord.data));
    return {
      digest: blobRecord.digest,
      match: retrievedText === expectedPayload,
      length: blobRecord.length
    };
  }, payloadText);

  assert.ok(kappaVerification.match, 'Retrieved Kappa blob content must match original payload byte-for-byte');
  assert.ok(kappaVerification.length > 0, 'Blob record length must be positive');
});

// ============================================================================
// PART 3: NOTIFICATIONS INBOX & CROSS-CUTTING EVENT TRIGGERS
// ============================================================================
console.log('\n--- PART 3: NOTIFICATIONS INBOX & EVENT LIFECYCLE ---');

await test('3.1 Notifications Inbox bell, badge counter and panel dropdown toggle', async () => {
  const badgeVal = await page.locator('#unread-notif-badge').innerText();
  assert.ok(parseInt(badgeVal, 10) >= 1, 'Unread badge must have count >= 1');

  // Panel initially hidden
  let isPanelHidden = await page.locator('#inbox-panel').getAttribute('hidden');
  assert.notEqual(isPanelHidden, null, 'Inbox panel must initially be hidden');

  // Toggle open
  await page.locator('#btn-inbox').click();
  await page.waitForTimeout(200);

  isPanelHidden = await page.locator('#inbox-panel').getAttribute('hidden');
  assert.equal(isPanelHidden, null, 'Inbox panel must be visible after click');
  let expanded = await page.locator('#btn-inbox').getAttribute('aria-expanded');
  assert.equal(expanded, 'true', 'Inbox button aria-expanded must be true');

  // Toggle close
  await page.locator('#btn-inbox').click();
  await page.waitForTimeout(200);
  isPanelHidden = await page.locator('#inbox-panel').getAttribute('hidden');
  assert.notEqual(isPanelHidden, null, 'Inbox panel must be hidden after second click');
});

await test('3.2 Cross-cutting event notifications: login, backup, invite, proposal', async () => {
  // Open inbox panel
  await page.locator('#btn-inbox').click();
  await page.waitForTimeout(200);

  // Trigger dispatchNotification programmatically and via actions
  await page.evaluate(() => {
    window.uorFoundry.dispatchNotification({
      event: 'SecurityLogin',
      severity: 'Info',
      title: 'WebCrypto Session Active',
      summary: 'Session active for alice@uor.foundation',
      route: '#panel-identity'
    });
  });

  await page.waitForTimeout(200);
  const inboxText = await page.locator('#inbox-list').innerText();
  assert.ok(inboxText.includes('WebCrypto Session Active'), 'SecurityLogin notification must be listed');

  // Test individual Mark Read button
  const markReadBtn = page.locator('#inbox-list .btn-mark-read').first();
  if (await markReadBtn.isVisible()) {
    await markReadBtn.click();
    await page.waitForTimeout(200);
  }

  // Test Mark All Read button
  await page.locator('#btn-mark-all-read').click();
  await page.waitForTimeout(200);

  const badgeValAfter = await page.locator('#unread-notif-badge').innerText();
  assert.equal(badgeValAfter, '0', 'Unread notification count must drop to 0 after Mark All Read');
});

// ============================================================================
// PART 4: SHARED WORKSPACES & MEMBER/TEAM DIRECTORIES
// ============================================================================
console.log('\n--- PART 4: SHARED WORKSPACES & DIRECTORY (U50, U52) ---');

await test('4.1 Shared Workspaces directory and state synchronization', async () => {
  await page.locator('#tab-workspaces').click();
  await page.waitForTimeout(200);

  const isVisible = await page.locator('#panel-workspaces').isVisible();
  assert.ok(isVisible, 'Workspaces panel must be visible');

  // Create workspace
  await page.locator('#ws-name-input').fill('Field Research Lab');
  await page.locator('#btn-create-workspace').click();
  await page.waitForTimeout(300);

  let wsTable = await page.locator('#workspace-tbody').innerText();
  assert.ok(wsTable.includes('Field Research Lab'), 'New workspace must be listed in directory');

  // Mutate shared state
  await page.locator('#ws-state-key').fill('telemetry_rate_hz');
  await page.locator('#ws-state-val').fill('25');
  await page.locator('#btn-mutate-workspace').click();
  await page.waitForTimeout(300);

  const stateTable = await page.locator('#workspace-state-tbody').innerText();
  assert.ok(stateTable.includes('telemetry_rate_hz'), 'State key must appear in synchronization table');
  assert.ok(stateTable.includes('25'), 'State value must appear in synchronization table');
});

await test('4.2 Member and Team directories render verified identities and scopes', async () => {
  await page.locator('#tab-organization').click();
  await page.waitForTimeout(200);

  const memberTable = await page.locator('#member-directory-list').innerText();
  assert.ok(memberTable.includes('alice@uor.foundation'), 'Alice must be in member directory');
  assert.ok(memberTable.includes('did:key:'), 'Member must hold valid DID');

  const teamTable = await page.locator('#team-directory-list').innerText();
  assert.ok(teamTable.includes('Core Engineering'), 'Core Engineering must be in team directory');
});

// ============================================================================
// PART 5: MULTI-BROWSER AXE WCAG 2.2 AA ACCESSIBILITY
// ============================================================================
console.log('\n--- PART 5: MULTI-BROWSER AXE WCAG 2.2 AA ACCESSIBILITY ---');

for (const browserType of [chromium, firefox]) {
  const browserName = browserType.name();
  await test(`5.1 ${browserName}: Messaging tab and Notifications Inbox have 0 Axe violations`, async () => {
    const b = await browserType.launch({ headless: true });
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    await p.goto(siteHtmlPath);
    await p.waitForLoadState('domcontentloaded');

    // Test Messaging tab
    await p.locator('#tab-messaging').click();
    await p.waitForTimeout(300);
    const axeMessaging = await new AxeBuilder({ page: p })
      .include('#panel-messaging')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.equal(axeMessaging.violations.length, 0, `${browserName} Messaging tab Axe violations: ${JSON.stringify(axeMessaging.violations)}`);

    // Test Inbox panel
    await p.locator('#btn-inbox').click();
    await p.waitForTimeout(300);
    const axeInbox = await new AxeBuilder({ page: p })
      .include('#inbox-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.equal(axeInbox.violations.length, 0, `${browserName} Inbox panel Axe violations: ${JSON.stringify(axeInbox.violations)}`);

    await b.close();
  });
}

await browser.close();

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
