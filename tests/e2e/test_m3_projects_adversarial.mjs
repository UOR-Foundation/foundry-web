import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../site/crypto.js';

const siteHtmlPath = pathToFileURL(resolve('site/index.html')).href;

console.log('================================================================');
console.log('CHALLENGER EMPIRICAL ADVERSARIAL SUITE (Milestone 3 - Projects)');
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

// Ensure Projects tab is active
await page.locator('#tab-projects').click();
await page.waitForTimeout(200);

// ============================================================================
// PART 1: GENESIS ACTIVITY LOG SPECIFICATION
// ============================================================================
console.log('\n--- PART 1: GENESIS ACTIVITY LOG INTEGRITY (64 ZEROES) ---');

await test('2.1 Genesis entry has exactly 64 zeroes for prev_entry_digest', async () => {
  const genesisCheck = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    if (!proj || !proj.activityLog || proj.activityLog.length === 0) {
      return { error: 'No project activity log found' };
    }
    const genesis = proj.activityLog[0];
    const prev = (genesis.prev_entry_digest || genesis.prevHash || '').replace(/^sha256:/, '');
    const actualDigest = (genesis.entry_digest || genesis.hash || '').replace(/^sha256:/, '');

    return {
      prev,
      prevLength: prev.length,
      isAllZeroes: /^0{64}$/.test(prev),
      digestLength: actualDigest.length,
      isValidHex: /^[0-9a-f]{64}$/.test(actualDigest)
    };
  });

  assert.equal(genesisCheck.prevLength, 64, 'Genesis prev_entry_digest must be exactly 64 characters');
  assert.equal(genesisCheck.isAllZeroes, true, 'Genesis prev_entry_digest must be exactly 64 zeroes');
  assert.equal(genesisCheck.digestLength, 64, 'Genesis entry_digest must be 64 characters');
  assert.equal(genesisCheck.isValidHex, true, 'Genesis entry_digest must be a valid 64-char hex string');
});

// ============================================================================
// PART 2: ADVERSARIAL ACTIVITY JOURNAL TAMPERING MATRIX
// ============================================================================
console.log('\n--- PART 2: ADVERSARIAL JOURNAL TAMPERING MATRIX ---');

// Append some activity items to have a multi-entry chain
await page.evaluate(async () => {
  const uor = window.uorFoundry;
  const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
  await uor.appendProjectActivity(proj, 'ActionOne', 'alice@uor.foundation', 'Param A=10');
  await uor.appendProjectActivity(proj, 'ActionTwo', 'bob@uor.foundation', 'Param B=20');
  await uor.appendProjectActivity(proj, 'ActionThree', 'charlie@uor.foundation', 'Param C=30');
  await uor.updateProjectsUI();
});

await test('2.2 Chain initially verifies cleanly before tampering', async () => {
  const initialVerify = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    return await uor.verifyActivityChain(proj.activityLog, proj.id);
  });
  assert.equal(initialVerify.valid, true, 'Initial activity chain must be valid');
});

await test('2.3 Tampering with historical details invalidates chain hash', async () => {
  const result = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const target = proj.activityLog[1];
    const orig = target.details;

    target.details = 'MALICIOUS_DETAILS_OVERWRITE';
    const tampered = await uor.verifyActivityChain(proj.activityLog, proj.id);

    target.details = orig;
    const restored = await uor.verifyActivityChain(proj.activityLog, proj.id);

    return { tamperedValid: tampered.valid, tamperedError: tampered.error, restoredValid: restored.valid };
  });

  assert.equal(result.tamperedValid, false, 'Tampered details must be rejected');
  assert.ok(result.tamperedError.includes('Digest mismatch'), 'Error must report digest mismatch');
  assert.equal(result.restoredValid, true, 'Restored details must pass verification');
});

await test('2.4 Tampering with historical actor invalidates chain hash', async () => {
  const result = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const target = proj.activityLog[2];
    const orig = target.actor;

    target.actor = 'impostor@attacker.org';
    const tampered = await uor.verifyActivityChain(proj.activityLog, proj.id);

    target.actor = orig;
    const restored = await uor.verifyActivityChain(proj.activityLog, proj.id);

    return { tamperedValid: tampered.valid, tamperedError: tampered.error, restoredValid: restored.valid };
  });

  assert.equal(result.tamperedValid, false, 'Tampered actor must be rejected');
  assert.ok(result.tamperedError.includes('Digest mismatch'), 'Error must report digest mismatch');
  assert.equal(result.restoredValid, true, 'Restored actor must pass verification');
});

await test('2.5 Tampering with historical timestamp invalidates chain hash', async () => {
  const result = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const target = proj.activityLog[1];
    const orig = target.timestamp;

    target.timestamp = '1970-01-01T00:00:00.000Z';
    const tampered = await uor.verifyActivityChain(proj.activityLog, proj.id);

    target.timestamp = orig;
    const restored = await uor.verifyActivityChain(proj.activityLog, proj.id);

    return { tamperedValid: tampered.valid, tamperedError: tampered.error, restoredValid: restored.valid };
  });

  assert.equal(result.tamperedValid, false, 'Tampered timestamp must be rejected');
  assert.ok(result.tamperedError.includes('Digest mismatch'), 'Error must report digest mismatch');
  assert.equal(result.restoredValid, true, 'Restored timestamp must pass verification');
});

await test('2.6 Tampering with historical action invalidates chain hash', async () => {
  const result = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const target = proj.activityLog[2];
    const orig = target.action;

    target.action = 'UnauthorizedPrivilegeEscalation';
    const tampered = await uor.verifyActivityChain(proj.activityLog, proj.id);

    target.action = orig;
    const restored = await uor.verifyActivityChain(proj.activityLog, proj.id);

    return { tamperedValid: tampered.valid, tamperedError: tampered.error, restoredValid: restored.valid };
  });

  assert.equal(result.tamperedValid, false, 'Tampered action must be rejected');
  assert.ok(result.tamperedError.includes('Digest mismatch'), 'Error must report digest mismatch');
  assert.equal(result.restoredValid, true, 'Restored action must pass verification');
});

await test('2.7 Splicing / deleting an intermediate entry breaks predecessor chain', async () => {
  const result = await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const removed = proj.activityLog.splice(1, 1)[0];

    const tampered = await uor.verifyActivityChain(proj.activityLog, proj.id);

    proj.activityLog.splice(1, 0, removed);
    const restored = await uor.verifyActivityChain(proj.activityLog, proj.id);

    return { tamperedValid: tampered.valid, tamperedError: tampered.error, restoredValid: restored.valid };
  });

  assert.equal(result.tamperedValid, false, 'Spliced entry must break predecessor chain');
  assert.ok(result.tamperedError.includes('Predecessor mismatch'), 'Error must report predecessor mismatch');
  assert.equal(result.restoredValid, true, 'Restored chain must pass verification');
});

// ============================================================================
// PART 3: DELIVERABLES PROOF & MILESTONE AUTO-COMPLETION
// ============================================================================
console.log('\n--- PART 3: DELIVERABLE PROOFS & MILESTONE AUTO-COMPLETION ---');

await test('2.8 Multi-deliverable milestone auto-completes only when all deliverables are verified', async () => {
  // Add test project with milestone and 2 deliverables via state and UI
  await page.evaluate(async () => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    proj.milestones = proj.milestones || [];
    const newM = {
      id: 'm-auto-test',
      title: 'Auto-Complete Stress Milestone',
      dueDate: '2026-12-31',
      status: 'Planned',
      deliverables: [
        { id: 'del-1', title: 'Specification Doc', status: 'Pending', digest: null },
        { id: 'del-2', title: 'Implementation Bin', status: 'Pending', digest: null }
      ]
    };
    proj.milestones.push(newM);
    await uor.updateProjectsUI();
  });

  // Verify initial milestone state
  let milestoneStatus = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const m = proj.milestones.find(item => item.id === 'm-auto-test');
    return m.status;
  });
  assert.equal(milestoneStatus, 'Planned', 'Initial milestone status must be Planned');

  // Verify Deliverable 1
  const del1Btn = page.locator('button[data-mid="m-auto-test"][data-did="del-1"]');
  await del1Btn.click();
  await page.waitForTimeout(300);

  // Check state after Deliverable 1 verified
  let stateAfterDel1 = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const m = proj.milestones.find(item => item.id === 'm-auto-test');
    return {
      mStatus: m.status,
      del1Status: m.deliverables[0].status,
      del1Digest: m.deliverables[0].digest,
      del2Status: m.deliverables[1].status
    };
  });

  assert.equal(stateAfterDel1.del1Status, 'Verified', 'Del 1 status must be Verified');
  assert.ok(stateAfterDel1.del1Digest.startsWith('sha256:'), 'Del 1 digest must have sha256: prefix');
  assert.equal(stateAfterDel1.del1Digest.length, 71, 'Del 1 digest must be sha256: + 64 hex chars');
  assert.notEqual(stateAfterDel1.mStatus, 'Completed', 'Milestone must NOT be Completed when Del 2 is still Pending');

  // Verify Deliverable 2
  const del2Btn = page.locator('button[data-mid="m-auto-test"][data-did="del-2"]');
  await del2Btn.click();
  await page.waitForTimeout(300);

  // Check state after Deliverable 2 verified
  let stateAfterDel2 = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const proj = uor.state.projects.find(p => p.id === uor.state.activeProjectId);
    const m = proj.milestones.find(item => item.id === 'm-auto-test');
    return {
      mStatus: m.status,
      del1Status: m.deliverables[0].status,
      del2Status: m.deliverables[1].status,
      del2Digest: m.deliverables[1].digest
    };
  });

  assert.equal(stateAfterDel2.del2Status, 'Verified', 'Del 2 status must be Verified');
  assert.ok(stateAfterDel2.del2Digest.startsWith('sha256:'), 'Del 2 digest must have sha256: prefix');
  assert.equal(stateAfterDel2.mStatus, 'Completed', 'Milestone must AUTO-COMPLETE when all deliverables are Verified');
});

// ============================================================================
// PART 4: ORGANIZATION RETIREMENT DYNAMIC SAFEGUARDS
// ============================================================================
console.log('\n--- PART 4: ORG RETIREMENT DYNAMIC SAFEGUARD VARIATIONS ---');

await test('2.9 Org retirement blocked with active projects; succeeds when projects are archived', async () => {
  await page.locator('#tab-organization').click();
  await page.waitForTimeout(200);

  // 1. Ensure retirement blocked while active projects exist
  let alertTriggered = false;
  page.once('dialog', async (dialog) => {
    alertTriggered = true;
    await dialog.accept();
  });
  await page.locator('#btn-retire-org').click();
  await page.waitForTimeout(200);
  assert.equal(alertTriggered, true, 'Alert must be triggered when retiring with active projects');

  let orgState = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const org = uor.state.organizations.find(o => o.id === uor.state.activeOrgId);
    return org.state;
  });
  assert.notEqual(orgState, 'Retired', 'Org must not be retired when blocked');

  // 2. Archive all projects belonging to this org
  await page.evaluate(async () => {
    const uor = window.uorFoundry;
    for (const p of uor.state.projects) {
      if (p.orgId === uor.state.activeOrgId) {
        p.state = 'Archived';
      }
    }
  });

  // Verify active count is now 0
  const activeCount = await page.evaluate(() => {
    const uor = window.uorFoundry;
    return uor.state.projects.filter(p => p.orgId === uor.state.activeOrgId && p.state === 'Active').length;
  });
  assert.equal(activeCount, 0, 'Active project count must be 0 after archiving all projects');

  // 3. Attempt retirement without 2 admins -> M2 quorum safeguard rejects
  await page.locator('#btn-retire-org').click();
  await page.waitForTimeout(200);

  orgState = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const org = uor.state.organizations.find(o => o.id === uor.state.activeOrgId);
    return org.state;
  });
  assert.notEqual(orgState, 'Retired', 'Org must not be retired when admin quorum (<2 admins) is not met');

  // 4. Add second administrator to satisfy M2 quorum
  await page.evaluate(() => {
    const uor = window.uorFoundry;
    const org = uor.state.organizations.find(o => o.id === uor.state.activeOrgId);
    org.admins.push({ email: 'bob@uor.foundation', scope: 'Organization' });
  });

  // 5. Attempt retirement now with 2 admins and 0 active projects -> MUST SUCCEED
  await page.locator('#btn-retire-org').click();
  await page.waitForTimeout(300);

  orgState = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const org = uor.state.organizations.find(o => o.id === uor.state.activeOrgId);
    return org.state;
  });
  assert.equal(orgState, 'Retired', 'Org must transition to Retired when active project count is 0 and quorum is met');

  const lifecycleBadge = await page.locator('#org-lifecycle-badge').innerText();
  assert.equal(lifecycleBadge, 'Retired', 'DOM badge must display Retired');
});

await test('2.10 Force override allows retirement even with active projects', async () => {
  // Reset org state to Provisional, reactivate a project, and check force override
  await page.evaluate(() => {
    const uor = window.uorFoundry;
    const org = uor.state.organizations.find(o => o.id === uor.state.activeOrgId);
    org.state = 'Provisional';
    // Re-activate first project
    if (uor.state.projects.length > 0) {
      uor.state.projects[0].state = 'Active';
    }
  });

  const activeCount = await page.evaluate(() => {
    const uor = window.uorFoundry;
    return uor.state.projects.filter(p => p.orgId === uor.state.activeOrgId && p.state === 'Active').length;
  });
  assert.equal(activeCount, 1, 'Active project count should be 1');

  // Enable force override checkbox
  await page.locator('#retire-force-override').check();
  await page.waitForTimeout(100);

  // Click retire
  await page.locator('#btn-retire-org').click();
  await page.waitForTimeout(300);

  const orgState = await page.evaluate(() => {
    const uor = window.uorFoundry;
    const org = uor.state.organizations.find(o => o.id === uor.state.activeOrgId);
    return org.state;
  });
  assert.equal(orgState, 'Retired', 'Org must retire when force_override is enabled despite active projects');
});

await browser.close();

console.log('\n================================================================');
console.log(`TOTAL ADVERSARIAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
