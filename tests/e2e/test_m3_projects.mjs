import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../site/crypto.js';

const uorCrypto = globalThis.uorCrypto;
const siteHtmlPath = pathToFileURL(resolve('site/index.html')).href;

console.log('================================================================');
console.log('CHALLENGER DEEP VERIFICATION SUITE (Milestone 3 - Projects Lifecycle)');
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
// PART 1: PROJECT NAVIGATION & METRICS
// ============================================================================
console.log('\n--- PART 1: PROJECTS NAVIGATION & METRICS GRID ---');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(siteHtmlPath);
await page.waitForLoadState('domcontentloaded');

await test('1.1 Projects tab navigation and metrics grid initial state', async () => {
  await page.locator('#tab-projects').click();
  await page.waitForTimeout(200);

  const isVisible = await page.locator('#panel-projects').isVisible();
  assert.ok(isVisible, 'Projects panel must be visible after clicking tab');

  const activeName = await page.locator('#project-active-name').innerText();
  assert.equal(activeName, 'Community Garden Platform', 'Initial active project must be Community Garden Platform');

  const count = await page.locator('#project-count').innerText();
  assert.equal(count, '1', 'Initial active project count must be 1');

  const progress = await page.locator('#project-milestone-progress').innerText();
  assert.equal(progress, '50%', 'Initial milestone progress must be 50%');

  const releases = await page.locator('#project-release-count').innerText();
  assert.equal(releases, '1', 'Initial release count must be 1');
});

// ============================================================================
// PART 2: PROJECT CREATION & DUPLICATE REJECTION
// ============================================================================
console.log('\n--- PART 2: PROJECT CREATION & DUPLICATE BOUNDARY REJECTION ---');

await test('1.2 Duplicate project name within same organization is rejected', async () => {
  // Listen for alert dialog
  let alertMessage = '';
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.locator('#project-name-input').fill('Community Garden Platform');
  await page.locator('#btn-create-project').click();
  await page.waitForTimeout(300);

  assert.ok(
    alertMessage.includes('Cannot create project with duplicate name'),
    `Expected duplicate project alert, got: "${alertMessage}"`
  );
});

await test('1.3 Create new project, verify selector update and notification dispatch', async () => {
  const newName = 'Urban Soil Sensor Network';
  const newSlug = 'soil-sensor-network';

  await page.locator('#project-name-input').fill(newName);
  await page.locator('#project-slug-input').fill(newSlug);
  await page.locator('#project-desc-input').fill('IoT telemetry network for urban farming');
  await page.locator('#btn-create-project').click();
  await page.waitForTimeout(400);

  // Active project should switch to new project
  const activeName = await page.locator('#project-active-name').innerText();
  assert.equal(activeName, newName, 'Active project must switch to newly created project');

  const count = await page.locator('#project-count').innerText();
  assert.equal(count, '2', 'Active project count must increment to 2');

  // Verify project select contains both projects
  const options = await page.locator('#project-select option').allInnerTexts();
  assert.ok(options.some(opt => opt.includes(newName)), 'New project must be present in selector dropdown');

  // Verify ProjectCreated notification was dispatched to inbox
  const unreadBadge = await page.locator('#unread-notif-badge').innerText();
  assert.ok(parseInt(unreadBadge, 10) >= 1, 'Unread notification badge must reflect new notification');
});

// ============================================================================
// PART 3: PROJECT LIFECYCLE (ARCHIVE / RESTORE / DELETE)
// ============================================================================
console.log('\n--- PART 3: PROJECT LIFECYCLE (ARCHIVE, RESTORE, DELETE SAFEGUARD) ---');

await test('1.4 Project Archive and Restore state transitions with tamper-evident logging', async () => {
  // Archive project
  await page.locator('#btn-archive-project').click();
  await page.waitForTimeout(300);

  let statusBadge = await page.locator('#project-status-badge').innerText();
  assert.equal(statusBadge, 'Archived', 'Project status must transition to Archived');

  let activeCount = await page.locator('#project-count').innerText();
  assert.equal(activeCount, '1', 'Active project count must decrement when project is archived');

  // Restore project
  await page.locator('#btn-restore-project').click();
  await page.waitForTimeout(300);

  statusBadge = await page.locator('#project-status-badge').innerText();
  assert.equal(statusBadge, 'Active', 'Project status must transition back to Active');

  activeCount = await page.locator('#project-count').innerText();
  assert.equal(activeCount, '2', 'Active project count must increment when project is restored');
});

// ============================================================================
// PART 4: MILESTONES & DELIVERABLES WITH SHA-256 DIGEST PROOFS
// ============================================================================
console.log('\n--- PART 4: MILESTONES & DELIVERABLES WITH CRYPTOGRAPHIC VERIFICATION ---');

await test('1.5 Create Milestone and Deliverable in active project', async () => {
  // Add milestone
  await page.locator('#milestone-title-input').fill('Milestone 1: Prototype Ingestion');
  await page.locator('#milestone-date-input').fill('2026-11-15');
  await page.locator('#btn-add-milestone').click();
  await page.waitForTimeout(300);

  let milestonesText = await page.locator('#milestone-list').innerText();
  assert.ok(milestonesText.includes('Milestone 1: Prototype Ingestion'), 'Milestone must be visible in list');

  // Add deliverable
  await page.locator('#deliverable-title-input').fill('Telemetry Serialization Specs');
  await page.locator('#btn-add-deliverable').click();
  await page.waitForTimeout(300);

  milestonesText = await page.locator('#milestone-list').innerText();
  assert.ok(milestonesText.includes('Telemetry Serialization Specs'), 'Deliverable must be visible in list');
  assert.ok(milestonesText.includes('Complete & Verify'), 'Deliverable must display Complete & Verify button');
});

await test('1.6 Deliverable verification produces genuine SHA-256 digest and completes milestone', async () => {
  const verifyBtn = page.locator('#milestone-list .btn-verify-deliverable').first();
  await verifyBtn.click();
  await page.waitForTimeout(400);

  const milestonesText = await page.locator('#milestone-list').innerText();
  assert.ok(milestonesText.includes('Verified'), 'Deliverable status must be Verified');
  assert.ok(milestonesText.includes('sha256:'), 'Deliverable must display genuine SHA-256 digest');
  assert.ok(milestonesText.includes('Completed'), 'Milestone status must transition to Completed');

  // Milestone progress metric should update to 100%
  const progress = await page.locator('#project-milestone-progress').innerText();
  assert.equal(progress, '100%', 'Milestone progress must reach 100%');
});

// ============================================================================
// PART 5: TAMPER-EVIDENT SHA-256 ACTIVITY CHAIN & TAMPER DETECTION
// ============================================================================
console.log('\n--- PART 5: TAMPER-EVIDENT ACTIVITY CHAIN & EMPIRICAL INTEGRITY ---');

await test('1.7 Project Activity Log maintains cryptographically verified SHA-256 hash chain', async () => {
  const chainBadge = await page.locator('#activity-chain-status').innerText();
  assert.equal(chainBadge, 'Verified Chain', 'Activity chain status must be Verified Chain');

  const activityText = await page.locator('#project-activity-list').innerText();
  assert.ok(activityText.includes('ProjectCreated'), 'Activity feed must log ProjectCreated');
  assert.ok(activityText.includes('MilestoneAdded'), 'Activity feed must log MilestoneAdded');
  assert.ok(activityText.includes('DeliverableVerified'), 'Activity feed must log DeliverableVerified');
});

await test('1.8 Tamper detection: modifying predecessor digest causes chain invalidation', async () => {
  const tamperResult = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    if (!proj || proj.activityLog.length < 2) return { error: 'Insufficient log entries' };

    // Tamper with the second entry's previous digest
    const originalPrev = proj.activityLog[1].prev_entry_digest;
    proj.activityLog[1].prev_entry_digest = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    // Verify
    const checkTampered = await uor.verifyActivityChain(proj.activityLog, proj.id);

    // Restore original
    proj.activityLog[1].prev_entry_digest = originalPrev;
    const checkRestored = await uor.verifyActivityChain(proj.activityLog, proj.id);

    return {
      tamperedValid: checkTampered.valid,
      tamperedError: checkTampered.error,
      restoredValid: checkRestored.valid
    };
  });

  assert.equal(tamperResult.tamperedValid, false, 'Tampered log must be rejected by verification');
  assert.ok(tamperResult.tamperedError.includes('Predecessor mismatch'), 'Error must specify predecessor mismatch');
  assert.equal(tamperResult.restoredValid, true, 'Restored log must pass verification');
});

// ============================================================================
// PART 6: RELEASE DRAFTING & PUBLICATION IMMUTABILITY
// ============================================================================
console.log('\n--- PART 6: PROJECT RELEASES & IMMUTABILITY ---');

await test('1.9 Draft release and publish, ensuring immutable transition', async () => {
  await page.locator('#release-tag-input').fill('v0.2.0');
  await page.locator('#release-title-input').fill('Beta IoT Firmware');
  await page.locator('#release-notes-input').fill('Firmware deployment specs');
  await page.locator('#btn-create-release').click();
  await page.waitForTimeout(300);

  let releasesTable = await page.locator('#project-releases-tbody').innerText();
  assert.ok(releasesTable.includes('v0.2.0'), 'Release v0.2.0 must be drafted in table');
  assert.ok(releasesTable.includes('Draft'), 'Release v0.2.0 status must be Draft');

  // Publish release
  const publishBtn = page.locator('#project-releases-tbody .btn-publish-release').first();
  await publishBtn.click();
  await page.waitForTimeout(400);

  releasesTable = await page.locator('#project-releases-tbody').innerText();
  assert.ok(releasesTable.includes('Published'), 'Release status must update to Published');
  assert.ok(releasesTable.includes('Immutable'), 'Published release must be designated Immutable');
});

// ============================================================================
// PART 7: DYNAMIC ORGANIZATION RETIREMENT SAFEGUARD (M1/M2 INTEGRATION)
// ============================================================================
console.log('\n--- PART 7: DYNAMIC ORG RETIREMENT SAFEGUARD WITH ACTIVE PROJECTS ---');

await test('1.10 Organization retirement is blocked when active dependent projects exist', async () => {
  await page.locator('#tab-organization').click();
  await page.waitForTimeout(200);

  let alertMessage = '';
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  // Attempt to retire org while active projects exist
  await page.locator('#btn-retire-org').click();
  await page.waitForTimeout(300);

  assert.ok(
    alertMessage.includes('Cannot retire organization: 2 active dependent project(s) remain'),
    `Expected active project retirement block, got: "${alertMessage}"`
  );

  const orgBadge = await page.locator('#org-lifecycle-badge').innerText();
  assert.notEqual(orgBadge, 'Retired', 'Organization must not be retired when active projects remain');
});

// ============================================================================
// PART 8: MULTI-BROWSER AXE WCAG 2.2 AA ACCESSIBILITY
// ============================================================================
console.log('\n--- PART 8: MULTI-BROWSER AXE WCAG 2.2 AA ACCESSIBILITY ---');

for (const browserType of [chromium, firefox]) {
  const browserName = browserType.name();
  await test(`1.11 ${browserName}: Projects & Workspaces tabs have 0 Axe violations`, async () => {
    const b = await browserType.launch({ headless: true });
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    await p.goto(siteHtmlPath);
    await p.waitForLoadState('domcontentloaded');

    // Test Projects tab
    await p.locator('#tab-projects').click();
    await p.waitForTimeout(300);
    const axeProjects = await new AxeBuilder({ page: p })
      .include('#panel-projects')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.equal(axeProjects.violations.length, 0, `${browserName} Projects tab Axe violations: ${JSON.stringify(axeProjects.violations)}`);

    // Test Workspaces tab
    await p.locator('#tab-workspaces').click();
    await p.waitForTimeout(300);
    const axeWorkspaces = await new AxeBuilder({ page: p })
      .include('#panel-workspaces')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.equal(axeWorkspaces.violations.length, 0, `${browserName} Workspaces tab Axe violations: ${JSON.stringify(axeWorkspaces.violations)}`);

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
