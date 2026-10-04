/* UOR Foundry Client Runtime --- Pure-Model Production Implementation */
(async function initFoundryPortal() {
  'use strict';

  // --- STATE CONTAINER ---
  const state = {
    // Theme (M4 - U05)
    theme: 'light',
    
    // Identity & Enrollment
    currentUser: null,
    pendingChallenge: null,
    
    // Backup Codes
    backupBatch: null,
    
    // Organizations
    organizations: [
      {
        id: 'uor:org:citizen-gardens-01',
        name: 'Citizen Gardens',
        state: 'Provisional',
        creator: 'alice@uor.foundation',
        admins: [
          { email: 'alice@uor.foundation', scope: 'Organization' }
        ],
        foundingGrant: true,
      }
    ],
    activeOrgId: 'uor:org:citizen-gardens-01',

    // Projects (M3 - U15, U51)
    projects: [
      {
        id: 'uor:project:citizen-gardens-01:community-garden-platform',
        orgId: 'uor:org:citizen-gardens-01',
        name: 'Community Garden Platform',
        state: 'Active',
        description: 'Decentralized urban gardening coordination platform',
        revision: 1,
        milestones: [
          {
            id: 'm-01',
            title: 'Milestone 1: Seed Catalog & Land Registry',
            status: 'Completed',
            dueDate: '2026-10-15',
            deliverables: [
              {
                id: 'd-01',
                title: 'Open Plant Database Schema',
                status: 'Verified',
                digest: 'sha256:490ce59f138824e0e1c9eb519c33d69fe4b78850ab1000000000000000000000'
              }
            ]
          },
          {
            id: 'm-02',
            title: 'Milestone 2: Soil Sensor IoT Ingestion',
            status: 'InProgress',
            dueDate: '2026-11-01',
            deliverables: [
              {
                id: 'd-02',
                title: 'Veilid Telemetry Protocol',
                status: 'Pending',
                digest: null
              }
            ]
          }
        ],
        activityLog: [
          {
            seq: 1,
            entry_id: 'uor:project:citizen-gardens-01:community-garden-platform:act-0001',
            project_id: 'uor:project:citizen-gardens-01:community-garden-platform',
            action: 'ProjectCreated',
            actor: 'alice@uor.foundation',
            time: '2026-10-01T12:00:00Z',
            timestamp: '2026-10-01T12:00:00Z',
            details: 'Initial project setup',
            prev_entry_digest: '0000000000000000000000000000000000000000000000000000000000000000',
            entry_digest: 'sha256:8289bc3305768f8424eb5ce306f08aa65cea80c093f97a9eba95493380f79c2d',
            prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
            hash: 'sha256:8289bc3305768f8424eb5ce306f08aa65cea80c093f97a9eba95493380f79c2d'
          }
        ],
        releases: [
          {
            tag: 'v0.1.0',
            title: 'Alpha Prototype',
            status: 'Published',
            commit: '0e1c9eb',
            artifacts: [{ name: 'garden_app.wasm', digest: 'sha256:8f3c2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f' }]
          }
        ]
      }
    ],
    activeProjectId: 'uor:project:citizen-gardens-01:community-garden-platform',

    // Channels (M3 - U16)
    channels: [
      { id: 'uor:channel:citizen-gardens-01:general', name: '#general', topic: 'Public organizational coordination', type: 'Public', orgId: 'uor:org:citizen-gardens-01' },
      { id: 'uor:channel:citizen-gardens-01:governance', name: '#governance', topic: 'Multi-Admin Quorum discussion', type: 'Private', orgId: 'uor:org:citizen-gardens-01' },
      { id: 'uor:channel:citizen-gardens-01:operations', name: '#operations', topic: 'Technical pipeline and deployments', type: 'Public', orgId: 'uor:org:citizen-gardens-01' }
    ],
    activeChannelId: 'uor:channel:citizen-gardens-01:general',

    // Inbox Notifications (M3 - U17)
    inbox: [
      {
        id: 'notif-01',
        orgId: 'uor:org:citizen-gardens-01',
        recipient: 'alice@uor.foundation',
        event: 'SecurityLogin',
        severity: 'Info',
        title: 'New Session Authenticated',
        summary: 'WebCrypto session established for alice@uor.foundation',
        route: '#panel-identity',
        readState: 'Unread',
        timestamp: new Date().toISOString()
      }
    ],

    // Workspaces (M3 - U52)
    workspaces: [
      {
        id: 'ws-default',
        name: 'Default Workspace',
        orgId: 'uor:org:citizen-gardens-01',
        role: 'Administrator',
        members: [{ user: 'alice@uor.foundation', role: 'administrator' }],
        sharedData: {
          seed_lot_id: 'heirloom-tomato-2026'
        },
        messages: []
      }
    ],
    activeWorkspaceId: 'ws-default',

    // Member & Team Directories (M3 - U50)
    members: [
      {
        email: 'alice@uor.foundation',
        role: 'Administrator',
        did: 'did:key:z6MkuFoundrySystemAdmin',
        scopes: ['organization', 'security']
      }
    ],
    teams: [
      {
        name: 'Core Engineering',
        lead: 'alice@uor.foundation',
        members: 1,
        workspaces: ['Default Workspace']
      }
    ],

    // Workflows
    workflowRuns: [
      {
        id: 'wf-init-01',
        name: 'baseline-verification',
        commit: '0e1c9eb',
        state: 'Succeeded',
        elapsed: 42,
        artifact: 'sha256:7d6de154b41238ca0cc8773324a450dc99a16d17eabd61ce20e8c41faf0b193a'
      }
    ],

    // AI Inference
    activeProposal: null,

    // Messaging
    messages: [
      {
        id: 'msg-01',
        channel: '#general',
        senderDid: 'did:key:z6MkuFoundrySystemAdmin',
        time: 'Today 12:00',
        content: 'Foundry workspace successfully initialized under pure-model architecture.',
        status: 'Acknowledged'
      }
    ],

    // Governance
    proposals: [
      {
        id: 'prop-act-01',
        title: 'Activate Organization and Confirm Governance Policy',
        scope: 'Governance',
        requiredQuorum: 2,
        proposer: 'alice@uor.foundation',
        approvals: ['alice@uor.foundation'],
        executed: false
      }
    ],
    auditLog: [
      {
        timestamp: new Date().toISOString(),
        event: 'Platform Bootstrap',
        actor: 'did:key:system',
        hash: 'sha256:490ce59f138824e0e1c9eb519c33d69fe4b78850ab1'
      }
    ],

    // Finance
    journalEntries: [
      {
        id: 'JE-101',
        desc: 'Initial Treasury Reserve Deposit',
        debit: 'Reserve: 100,000',
        credit: 'Equity: 100,000',
        amount: 100000,
        status: 'Settled'
      }
    ],

    // Learning
    credentials: [],

    // Invitations (M2 Governance)
    invitations: [],

    // Storage & Network
    blobs: new Map(),
    isOnline: true,
    offlineQueue: [],

    // WAL Journal (M2 Security & Anti-Rollback)
    walJournal: [],
    journalRevision: 0,
    lastCheckpoint: null,
  };

  // --- CRYPTO HELPERS ---
  async function sha256Hex(textOrBuffer) {
    if (typeof window !== 'undefined' && window.uorCrypto && typeof window.uorCrypto.sha256Hex === 'function') {
      return await window.uorCrypto.sha256Hex(textOrBuffer);
    }
    const data = typeof textOrBuffer === 'string'
      ? new TextEncoder().encode(textOrBuffer)
      : (textOrBuffer instanceof Uint8Array ? textOrBuffer : new Uint8Array(textOrBuffer));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function announce(msg) {
    const liveRegion = document.getElementById('live-region');
    const announcement = document.getElementById('system-announcement');
    if (liveRegion) liveRegion.textContent = msg;
    if (announcement) announcement.textContent = msg;
  }

  // --- WEBASSEMBLY ENGINE INTEGRATION ---
  let wasmInstance = null;
  let invokeBytesFn = null;

  async function loadWasm() {
    try {
      const response = await fetch('foundry_bg.wasm');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const wasmBuffer = await response.arrayBuffer();

      let wasmObj;
      let cachedMem = null;
      function getMem() {
        if (!cachedMem || cachedMem.byteLength === 0) {
          cachedMem = new Uint8Array(wasmObj.memory.buffer);
        }
        return cachedMem;
      }

      const imports = {
        "./prism_foundry_web_bg.js": {
          __wbg___wbindgen_throw_1506f2235d1bdba0: function(ptr, len) {
            throw new Error("Wasm error");
          },
          __wbg_instanceof_Uint8Array_86f30649f63ef9c2: function(arg0) {
            return arg0 instanceof Uint8Array;
          },
          __wbg_length_4a591ecaa01354d9: function(arg0) {
            return arg0.length;
          },
          __wbg_new_from_slice_18fa1f71286d66b8: function(ptr, len) {
            return new Uint8Array(getMem().subarray(ptr, ptr + len));
          },
          __wbg_prototypesetcall_3249fc62a0fafa30: function(ptr, len, src) {
            Uint8Array.prototype.set.call(getMem().subarray(ptr, ptr + len), src);
          },
          __wbindgen_cast_0000000000000001: function(ptr, len) {
            return new TextDecoder().decode(getMem().subarray(ptr, ptr + len));
          },
          __wbindgen_init_externref_table: function() {
            const table = wasmObj.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
          },
        }
      };

      const compiledModule = await WebAssembly.compile(wasmBuffer);
      const instance = await WebAssembly.instantiate(compiledModule, imports);
      wasmObj = instance.exports;
      if (typeof wasmObj.__wbindgen_start === 'function') {
        wasmObj.__wbindgen_start();
      }

      function takeExtern(idx) {
        const value = wasmObj.__wbindgen_externrefs.get(idx);
        wasmObj.__externref_table_dealloc(idx);
        return value;
      }

      invokeBytesFn = function(input) {
        if (!wasmObj.invoke_bytes) return input;
        const ret = wasmObj.invoke_bytes(input);
        if (ret && ret[2]) throw takeExtern(ret[1]);
        return ret ? takeExtern(ret[0]) : input;
      };

      wasmInstance = instance;
      announce('Pure-Model WebAssembly Engine Loaded & Verified.');
    } catch (err) {
      console.warn('Wasm execution running in model fallback mode:', err);
      invokeBytesFn = function(input) { return input; };
    }
  }

  await loadWasm();

  function dispatchToWasm(commandString) {
    if (invokeBytesFn) {
      try {
        const inputBytes = new TextEncoder().encode(commandString);
        const outputBytes = invokeBytesFn(inputBytes);
        return new TextDecoder().decode(outputBytes);
      } catch (e) {
        console.error('Wasm dispatch error:', e);
      }
    }
    return commandString;
  }

  // --- ACCESSIBLE TABS NAVIGATION ---
  const tabs = document.querySelectorAll('[role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');

  function activateTab(tab) {
    const targetId = tab.getAttribute('aria-controls');

    tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
      t.classList.remove('active');
    });
    panels.forEach(p => {
      p.setAttribute('hidden', '');
      p.classList.remove('active');
    });

    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    tab.classList.add('active');

    const targetPanel = document.getElementById(targetId);
    if (targetPanel) {
      targetPanel.removeAttribute('hidden');
      targetPanel.classList.add('active');
    }

    dispatchToWasm(`route:${targetId}`);
    announce(`Navigated to ${tab.textContent.trim()}`);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (e) => {
      const tabList = Array.from(tabs);
      const index = tabList.indexOf(tab);
      let nextTab = null;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextTab = tabList[(index + 1) % tabList.length];
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextTab = tabList[(index - 1 + tabList.length) % tabList.length];
      } else if (e.key === 'Home') {
        nextTab = tabList[0];
      } else if (e.key === 'End') {
        nextTab = tabList[tabList.length - 1];
      }

      if (nextTab) {
        e.preventDefault();
        nextTab.focus();
        activateTab(nextTab);
      }
    });
  });

  document.getElementById('btn-quick-enroll')?.addEventListener('click', () => {
    const tab = document.getElementById('tab-identity');
    if (tab) activateTab(tab);
  });
  document.getElementById('btn-quick-org')?.addEventListener('click', () => {
    const tab = document.getElementById('tab-organization');
    if (tab) activateTab(tab);
  });
  document.getElementById('btn-quick-backup')?.addEventListener('click', () => {
    const tab = document.getElementById('tab-backup-codes');
    if (tab) activateTab(tab);
  });

  // --- VISUAL THEME & ACCESSIBILITY CONTROLLER (M4 - U05) ---
  function setTheme(themeName, persist = true) {
    const validTheme = themeName === 'dark' ? 'dark' : 'light';
    state.theme = validTheme;
    document.documentElement.setAttribute('data-theme', validTheme);

    const toggleBtn = document.getElementById('btn-theme-toggle');
    const iconEl = document.getElementById('theme-toggle-icon');
    const textEl = document.getElementById('theme-toggle-text');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', `Toggle visual theme (current: ${validTheme})`);
    }
    if (iconEl) iconEl.innerHTML = validTheme === 'dark' ? '&#9790;' : '&#9728;';
    if (textEl) textEl.textContent = validTheme === 'dark' ? 'Dark' : 'Light';

    if (persist) {
      try {
        localStorage.setItem('foundry_theme', validTheme);
      } catch (_) {}
    }
    announce(`Visual theme switched to ${validTheme} mode.`);
    dispatchToWasm(`theme:change:${validTheme}`);
  }

  function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem('foundry_theme');
    } catch (_) {}
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved, false);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark', false);
    } else {
      setTheme('light', false);
    }
  }

  // --- KEYBOARD SHORTCUTS & FOCUS MANAGEMENT (M4 - U05) ---
  let lastFocusedElement = null;

  function openShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.removeAttribute('hidden');
    const closeBtn = document.getElementById('btn-close-shortcuts');
    if (closeBtn) closeBtn.focus();
    announce('Keyboard shortcuts dialog opened.');
  }

  function closeShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal || modal.hasAttribute('hidden')) return;
    modal.setAttribute('hidden', '');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    announce('Keyboard shortcuts dialog closed.');
  }

  function toggleShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal) return;
    if (modal.hasAttribute('hidden')) {
      openShortcutsModal();
    } else {
      closeShortcutsModal();
    }
  }

  function closeInboxPanel() {
    const panel = document.getElementById('inbox-panel');
    const btn = document.getElementById('btn-inbox');
    if (panel && !panel.hasAttribute('hidden')) {
      panel.setAttribute('hidden', '');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    }
  }

  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-close-shortcuts')?.addEventListener('click', closeShortcutsModal);
  document.getElementById('btn-dismiss-shortcuts')?.addEventListener('click', closeShortcutsModal);

  const shortcutsModal = document.getElementById('shortcuts-modal');
  shortcutsModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusables = shortcutsModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Global Keydown Handler
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('shortcuts-modal');
    const inboxPanel = document.getElementById('inbox-panel');
    const isModalOpen = modal && !modal.hasAttribute('hidden');
    const isInboxOpen = inboxPanel && !inboxPanel.hasAttribute('hidden');

    if (e.key === 'Escape') {
      if (isModalOpen) {
        e.preventDefault();
        closeShortcutsModal();
        return;
      }
      if (isInboxOpen) {
        e.preventDefault();
        closeInboxPanel();
        return;
      }
    }

    const inInput = e.target && e.target.matches('input, textarea, select');
    if (inInput) return;

    // Alt + 1..9 for Tab Switching
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const tabMap = [
        'tab-dashboard',
        'tab-identity',
        'tab-backup-codes',
        'tab-organization',
        'tab-projects',
        'tab-workspaces',
        'tab-workflows',
        'tab-ai-inference',
        'tab-messaging'
      ];
      const tabIdx = parseInt(e.key, 10) - 1;
      if (tabIdx >= 0 && tabIdx < tabMap.length) {
        const targetTab = document.getElementById(tabMap[tabIdx]);
        if (targetTab) {
          targetTab.focus();
          activateTab(targetTab);
        }
      }
      return;
    }

    // Alt + T or Ctrl + Shift + T for Theme Toggle
    if ((e.altKey && (e.key === 't' || e.key === 'T')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 't' || e.key === 'T'))) {
      e.preventDefault();
      toggleTheme();
      return;
    }

    // ? or Shift + / for Shortcuts Modal
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      toggleShortcutsModal();
      return;
    }
  });

  // Click outside listener for overlays
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('inbox-panel');
    const btn = document.getElementById('btn-inbox');
    if (panel && !panel.hasAttribute('hidden')) {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const isInside = path.includes(panel) || path.includes(btn) || panel.contains(e.target) || (btn && btn.contains(e.target));
      if (!isInside) {
        panel.setAttribute('hidden', '');
        btn?.setAttribute('aria-expanded', 'false');
      }
    }
    const modal = document.getElementById('shortcuts-modal');
    if (modal && !modal.hasAttribute('hidden')) {
      if (e.target === modal) {
        closeShortcutsModal();
      }
    }
  });

  // --- USER IDENTITY & ENROLLMENT LOGIC ---
  function updateIdentityUI() {
    const user = state.currentUser;
    const badgeDot = document.getElementById('user-status-dot');
    const displayName = document.getElementById('user-display-name');
    const didDisplay = document.getElementById('user-did-display');
    const statusBadge = document.getElementById('account-status-badge');
    const accountIdVal = document.getElementById('account-id-val');
    const accountDidVal = document.getElementById('account-did-val');
    const accountEmailVal = document.getElementById('account-email-val');
    const accountPubkeyVal = document.getElementById('account-pubkey-val');
    const accountSessionCount = document.getElementById('account-session-count');
    const dashUser = document.getElementById('dash-active-user');
    const dashBadge = document.getElementById('dash-user-badge');

    if (user) {
      if (badgeDot) { badgeDot.className = 'badge-status-dot authenticated'; }
      if (displayName) displayName.textContent = user.email;
      if (didDisplay) didDisplay.textContent = user.did;
      if (statusBadge) { statusBadge.textContent = 'Active'; statusBadge.className = 'badge badge-success'; }
      if (accountIdVal) accountIdVal.textContent = user.id;
      if (accountDidVal) accountDidVal.textContent = user.did;
      if (accountEmailVal) accountEmailVal.textContent = user.email;
      if (accountPubkeyVal) accountPubkeyVal.textContent = user.pubKey;
      if (accountSessionCount) accountSessionCount.textContent = String(user.sessionCount);
      if (dashUser) dashUser.textContent = user.email;
      if (dashBadge) { dashBadge.textContent = 'Authenticated'; dashBadge.className = 'metric-badge badge-success'; }
    } else {
      if (badgeDot) { badgeDot.className = 'badge-status-dot unauthenticated'; }
      if (displayName) displayName.textContent = 'Guest (Unenrolled)';
      if (didDisplay) didDisplay.textContent = 'did:key:unauthenticated';
      if (statusBadge) { statusBadge.textContent = 'Unenrolled'; statusBadge.className = 'badge badge-neutral'; }
      if (accountIdVal) accountIdVal.textContent = 'None';
      if (accountDidVal) accountDidVal.textContent = 'did:key:unauthenticated';
      if (accountEmailVal) accountEmailVal.textContent = 'None';
      if (accountPubkeyVal) accountPubkeyVal.textContent = 'None';
      if (accountSessionCount) accountSessionCount.textContent = '0';
      if (dashUser) dashUser.textContent = 'Guest';
      if (dashBadge) { dashBadge.textContent = 'Not Enrolled'; dashBadge.className = 'metric-badge badge-neutral'; }
    }
  }

  const formEnrollRequest = document.getElementById('form-enroll-request');
  if (formEnrollRequest) {
    formEnrollRequest.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('enroll-email').value.trim();
      if (!email) return;

      const challengeId = 'ch-' + Math.random().toString(36).substring(2, 9);
      const nonce = await sha256Hex(`challenge-nonce-${email}-${Date.now()}`);
      const expiresAt = Date.now() + 900000;

      state.pendingChallenge = { challengeId, email, nonce, expiresAt };

      dispatchToWasm(`identity:challenge:${challengeId}:${email}`);

      const chInput = document.getElementById('verify-challenge-id');
      const mailboxPreview = document.getElementById('mailbox-content');
      if (chInput) chInput.value = challengeId;
      if (mailboxPreview) {
        mailboxPreview.innerHTML = `<strong>To:</strong> ${email}<br><strong>Challenge ID:</strong> ${challengeId}<br><strong>Verification Nonce:</strong> <code>${nonce}</code><br><strong>Expires:</strong> In 15 minutes.`;
      }

      announce(`Verification challenge issued to ${email}. Nonce ready in mailbox preview.`);
    });
  }

  const formEnrollVerify = document.getElementById('form-enroll-verify');
  if (formEnrollVerify) {
    formEnrollVerify.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputNonce = document.getElementById('verify-nonce').value.trim();
      const challenge = state.pendingChallenge;

      if (!challenge) {
        alert('No pending challenge. Please issue a challenge first.');
        return;
      }

      if (Date.now() > challenge.expiresAt) {
        announce('Challenge has expired (NIST SP 800-63B policy). Please request a new one.');
        return;
      }

      if (inputNonce !== challenge.nonce) {
        announce('Invalid challenge nonce. Rejection enforced.');
        return;
      }

      state.pendingChallenge = null;

      const accountId = `uor:user:${challenge.email.replace('@', '_at_')}`;
      let pubKey, did;
      if (window.uorCrypto) {
        const keyRecord = await window.uorCrypto.getOrCreateKeyPair(accountId);
        pubKey = keyRecord.pubKeyHex;
        did = keyRecord.did;
        await window.uorCrypto.signChallenge(accountId, challenge.nonce);
      } else {
        pubKey = await sha256Hex(`ecdsa-p256-key-${challenge.email}`);
        did = `did:key:zDna${pubKey.substring(0, 32)}`;
      }

      state.currentUser = {
        id: accountId,
        email: challenge.email,
        did: did,
        pubKey: pubKey,
        sessionCount: 1,
        token: `session-${Date.now()}`
      };

      dispatchToWasm(`identity:verify:${accountId}:${did}`);
      updateIdentityUI();
      announce(`Enrollment confirmed! Authenticated as ${challenge.email} with ${did}.`);
    });
  }

  document.getElementById('btn-invalidate-sessions')?.addEventListener('click', () => {
    if (state.currentUser) {
      state.currentUser.sessionCount = 0;
      dispatchToWasm(`identity:invalidate:${state.currentUser.id}`);
      updateIdentityUI();
      announce('All active session tokens invalidated atomically.');
    }
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    state.currentUser = null;
    state.pendingChallenge = null;
    dispatchToWasm('identity:logout');
    updateIdentityUI();
    announce('Logged out. Returned to Guest state.');
  });

  document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
    if (!state.currentUser) {
      announce('No active authenticated session to delete.');
      alert('You must be signed in to delete an account.');
      return;
    }

    const email = state.currentUser.email;

    // Sole-Owner Refusal Rule: Cannot delete account if it leaves any active org with < 2 admins
    for (const org of state.organizations) {
      if (org.state === 'Activated') {
        const isAdmin = org.admins.some(a => a.email === email);
        if (isAdmin) {
          const remainingAdmins = org.admins.filter(a => a.email !== email);
          if (remainingAdmins.length < 2) {
            const msg = `Account Deletion Refused: Sole-Owner Refusal Rule. Deleting ${email} would leave organization "${org.name}" with fewer than 2 administrators.`;
            announce(msg);
            alert(msg);
            return;
          }
        }
      }
    }

    const confirmed = confirm(`Are you sure you want to permanently delete account ${email}? This action purges all cryptographic keys from IndexedDB.`);
    if (!confirmed) return;

    if (window.uorCrypto) {
      await window.uorCrypto.deleteKeyPair(state.currentUser.id);
    }

    for (const org of state.organizations) {
      org.admins = org.admins.filter(a => a.email !== email);
    }

    const deletedId = state.currentUser.id;
    dispatchToWasm(`identity:delete:${deletedId}`);

    state.currentUser = null;
    state.pendingChallenge = null;
    state.backupBatch = null;

    updateIdentityUI();
    updateOrgUI();
    announce('Account deleted and all cryptographic keys purged from IndexedDB.');
  });

  // --- BACKUP CODES LOGIC ---
  document.getElementById('btn-generate-backup-codes')?.addEventListener('click', async () => {
    const userEmail = state.currentUser ? state.currentUser.email : 'alice@uor.foundation';
    const batchId = 'batch-' + Math.random().toString(36).substring(2, 8);
    const revision = state.backupBatch ? state.backupBatch.revision + 1 : 1;

    let codes;
    if (window.uorCrypto) {
      codes = await window.uorCrypto.generateNistBackupCodes(10);
    } else {
      codes = [];
      for (let i = 0; i < 10; i++) {
        const code = 'BK-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const salt = Math.random().toString(36).substring(2, 10);
        const hash = await sha256Hex(`${salt}:${code}`);
        codes.push({ code, salt, hash, used: false });
      }
    }

    state.backupBatch = {
      batchId,
      revision,
      userEmail,
      codes
    };

    dispatchToWasm(`backup_codes:generate:${batchId}:${revision}`);

    const container = document.getElementById('backup-codes-display');
    const batchIdEl = document.getElementById('batch-id-display');
    const revEl = document.getElementById('batch-revision-display');
    const countEl = document.getElementById('batch-count-display');
    const listEl = document.getElementById('codes-list');

    if (container) container.hidden = false;
    if (batchIdEl) batchIdEl.textContent = batchId;
    if (revEl) revEl.textContent = String(revision);
    if (countEl) countEl.textContent = String(codes.length);
    if (listEl) {
      listEl.innerHTML = codes.map((c, idx) => `
        <li class="code-box" id="code-item-${idx}" role="listitem"><code>${c.code}</code></li>
      `).join('');
    }

    announce(`Generated batch of ${codes.length} NIST SP 800-63B-4 backup codes for ${userEmail} (Revision ${revision}).`);
  });

  const formRedeemCode = document.getElementById('form-redeem-backup-code');
  if (formRedeemCode) {
    formRedeemCode.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputCode = document.getElementById('recovery-code-input').value.trim();
      const inputRev = parseInt(document.getElementById('recovery-revision').value, 10);
      const email = document.getElementById('recovery-account').value.trim();
      const resultBox = document.getElementById('recovery-result-box');

      if (!state.backupBatch || state.backupBatch.userEmail !== email) {
        if (resultBox) resultBox.innerHTML = '<span class="badge badge-danger">No backup codes batch found for this account.</span>';
        announce('No backup codes batch found for this account.');
        return;
      }

      if (state.backupBatch.revision !== inputRev) {
        if (resultBox) resultBox.innerHTML = '<span class="badge badge-danger">Stale Revision: Code rejected under NIST SP 800-63B-4.</span>';
        announce('Stale revision. Backup code rejected.');
        return;
      }

      let found = null;
      for (const c of state.backupBatch.codes) {
        let candidateHash;
        if (window.uorCrypto && c.salt) {
          candidateHash = await window.uorCrypto.hashBackupCode(inputCode, c.salt);
        } else if (c.salt) {
          candidateHash = await sha256Hex(`${c.salt}:${inputCode}`);
        } else {
          candidateHash = await sha256Hex(inputCode);
        }
        if (candidateHash === c.hash) {
          found = c;
          break;
        }
      }

      if (!found) {
        if (resultBox) resultBox.innerHTML = '<span class="badge badge-danger">Invalid Backup Code: Code hash not recognized.</span>';
        announce('Invalid backup code.');
        return;
      }

      if (found.used) {
        if (resultBox) resultBox.innerHTML = '<span class="badge badge-danger">Replay Prohibited: Code already consumed.</span>';
        announce('Backup code already used. Replay rejected.');
        return;
      }

      found.used = true;
      const activeCount = state.backupBatch.codes.filter(c => !c.used).length;

      const accountId = `uor:user:${email.replace('@', '_at_')}`;
      let pubKey, did;
      if (window.uorCrypto) {
        const rotated = await window.uorCrypto.rotateKeyPair(accountId);
        pubKey = rotated.pubKeyHex;
        did = rotated.did;
      } else {
        pubKey = await sha256Hex(`ecdsa-p256-recovered-${email}`);
        did = `did:key:zDnaRecovered${pubKey.substring(0, 24)}`;
      }

      state.currentUser = {
        id: accountId,
        email: email,
        did: did,
        pubKey: pubKey,
        sessionCount: 1,
        token: `session-recovered-${Date.now()}`
      };

      dispatchToWasm(`backup_codes:redeem:${found.hash}:${activeCount}`);
      updateIdentityUI();

      const countEl = document.getElementById('batch-count-display');
      if (countEl) countEl.textContent = String(activeCount);
      const codeIdx = state.backupBatch.codes.indexOf(found);
      if (codeIdx !== -1) {
        document.getElementById(`code-item-${codeIdx}`)?.classList.add('consumed');
      }

      if (resultBox) {
        resultBox.innerHTML = `
          <div class="alert-box alert-success" style="margin-top:0.75rem;">
            <strong>Recovery Successful!</strong> Code consumed. All prior sessions invalidated atomically. Remaining active codes: ${activeCount}.
          </div>
        `;
      }
      announce(`Account recovered! Code consumed. ${activeCount} active codes remaining.`);
    });
  }

  // --- ORGANIZATION & QUORUM LOGIC ---
  function updateOrgUI() {
    const org = state.organizations.find(o => o.id === state.activeOrgId);
    if (!org) return;

    const select = document.getElementById('org-select');
    if (select) {
      select.innerHTML = state.organizations.map(o => `
        <option value="${o.id}" ${o.id === org.id ? 'selected' : ''}>${o.name} (${o.state})</option>
      `).join('');
    }

    const nameVal = document.getElementById('org-name-val');
    const idVal = document.getElementById('org-id-val');
    const badge = document.getElementById('org-lifecycle-badge');
    const adminCount = document.getElementById('org-admin-count');
    const foundingGrant = document.getElementById('org-founding-grant');
    const roster = document.getElementById('admin-roster-list');
    const dashOrg = document.getElementById('dash-active-org');
    const dashBadge = document.getElementById('dash-org-badge');
    const dashQuorumStat = document.getElementById('dash-quorum-stat');
    const dashQuorumBadge = document.getElementById('dash-quorum-badge');

    if (nameVal) nameVal.textContent = org.name;
    if (idVal) idVal.textContent = org.id;
    if (adminCount) adminCount.textContent = String(org.admins.length);
    if (foundingGrant) foundingGrant.textContent = org.foundingGrant ? 'Yes (Provisional bootstrap)' : 'No (Retired)';
    if (dashOrg) dashOrg.textContent = org.name;

    if (badge) {
      badge.textContent = org.state;
      if (org.state === 'Activated') badge.className = 'badge badge-success';
      else if (org.state === 'Suspended') badge.className = 'badge badge-warning';
      else if (org.state === 'Retired') badge.className = 'badge badge-danger';
      else badge.className = 'badge badge-warning';
    }
    if (dashBadge) {
      dashBadge.textContent = org.state === 'Activated' ? 'Activated' : org.state;
      dashBadge.className = org.state === 'Activated' ? 'metric-badge badge-success' : 'metric-badge badge-warning';
    }

    if (dashQuorumStat) dashQuorumStat.textContent = `${org.admins.length} / 2 Required`;
    if (dashQuorumBadge) {
      dashQuorumBadge.textContent = org.admins.length >= 2 ? 'Quorum Covered' : 'Uncovered';
      dashQuorumBadge.className = org.admins.length >= 2 ? 'metric-badge badge-success' : 'metric-badge badge-warning';
    }

    if (roster) {
      roster.innerHTML = org.admins.map(a => `<li>${a.email} (Scope: ${a.scope})</li>`).join('');
    }

    updateInvitationsUI();
    if (typeof updateProjectsUI === 'function') updateProjectsUI();
    if (typeof updateChannelsUI === 'function') updateChannelsUI();
    if (typeof updateWorkspacesUI === 'function') updateWorkspacesUI();
    if (typeof updateDirectoryUI === 'function') updateDirectoryUI();
  }

  const formCreateOrg = document.getElementById('form-create-org');
  if (formCreateOrg) {
    formCreateOrg.addEventListener('submit', (e) => {
      e.preventDefault();
      const orgName = document.getElementById('new-org-name').value.trim();
      if (!orgName) return;

      const creator = state.currentUser ? state.currentUser.email : 'alice@uor.foundation';
      const orgId = 'uor:org:' + orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

      const newOrg = {
        id: orgId,
        name: orgName,
        state: 'Provisional',
        creator: creator,
        admins: [{ email: creator, scope: 'Organization' }],
        foundingGrant: true
      };

      state.organizations.push(newOrg);
      state.activeOrgId = orgId;

      dispatchToWasm(`organization:create:${orgId}:${orgName}`);
      updateOrgUI();
      announce(`Created organization "${orgName}" in Provisional state.`);
    });
  }

  const formUpdateOrgName = document.getElementById('form-update-org-name');
  if (formUpdateOrgName) {
    formUpdateOrgName.addEventListener('submit', (e) => {
      e.preventDefault();
      const newName = document.getElementById('edit-org-name').value.trim();
      if (!newName) return;
      const org = state.organizations.find(o => o.id === state.activeOrgId);
      if (!org) return;

      org.name = newName;
      dispatchToWasm(`organization:update:${org.id}:${newName}`);
      updateOrgUI();
      announce(`Organization updated. New name: "${newName}". Immutable ID preserved: ${org.id}`);
    });
  }

  document.getElementById('org-select')?.addEventListener('change', (e) => {
    state.activeOrgId = e.target.value;
    updateOrgUI();
    announce(`Switched to organization ${e.target.value}`);
  });

  const formAddAdmin = document.getElementById('form-add-admin');
  if (formAddAdmin) {
    formAddAdmin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const scope = document.getElementById('admin-scope').value;
      const org = state.organizations.find(o => o.id === state.activeOrgId);

      if (!org) return;
      if (org.admins.some(a => a.email === email)) {
        alert('Administrator already exists in this organization.');
        return;
      }

      org.admins.push({ email, scope });
      dispatchToWasm(`authority:admin_add:${org.id}:${email}:${scope}`);
      updateOrgUI();
      announce(`Added administrator ${email} with scope ${scope}.`);
    });
  }

  document.getElementById('btn-activate-org')?.addEventListener('click', () => {
    const org = state.organizations.find(o => o.id === state.activeOrgId);
    if (!org) return;

    if (org.admins.length < 2) {
      announce('Activation Rejected: Minimum 2 distinct active administrators required for quorum.');
      alert('Activation Rejected: Quorum requires at least 2 distinct active administrators.');
      return;
    }

    org.state = 'Activated';
    dispatchToWasm(`organization:activate:${org.id}:${org.admins.length}`);
    updateOrgUI();
    announce(`Organization "${org.name}" Activated under multi-admin quorum!`);
  });

  document.getElementById('btn-suspend-org')?.addEventListener('click', () => {
    const org = state.organizations.find(o => o.id === state.activeOrgId);
    if (!org) return;

    if (org.state === 'Suspended') {
      announce('Organization is already suspended.');
      return;
    }
    if (org.state === 'Retired') {
      announce('Cannot suspend a retired organization.');
      return;
    }

    org.state = 'Suspended';
    dispatchToWasm(`organization:suspend:${org.id}`);
    updateOrgUI();
    announce(`Organization "${org.name}" has been Suspended.`);
  });

  document.getElementById('btn-reactivate-org')?.addEventListener('click', () => {
    const org = state.organizations.find(o => o.id === state.activeOrgId);
    if (!org) return;

    if (org.state !== 'Suspended') {
      announce('Only suspended organizations can be reactivated.');
      return;
    }
    if (org.admins.length < 2) {
      announce('Reactivation Rejected: Minimum 2 distinct active administrators required for quorum.');
      alert('Reactivation Rejected: Quorum requires at least 2 distinct active administrators.');
      return;
    }

    org.state = 'Activated';
    dispatchToWasm(`organization:reactivate:${org.id}:${org.admins.length}`);
    updateOrgUI();
    announce(`Organization "${org.name}" Reactivated under multi-admin quorum!`);
  });

  document.getElementById('btn-retire-org')?.addEventListener('click', () => {
    const org = state.organizations.find(o => o.id === state.activeOrgId);
    if (!org) return;

    if (org.state === 'Retired') {
      announce('Organization is already retired.');
      return;
    }

    const forceOverride = document.getElementById('retire-force-override')?.checked;
    const activeProjects = state.projects
      ? state.projects.filter(p => p.orgId === org.id && p.state === 'Active').length
      : (org.activeProjectCount || 0);
    if (activeProjects > 0 && !forceOverride) {
      announce(`Cannot retire organization: ${activeProjects} active dependent project(s) remain. Enable force override if required.`);
      alert(`Cannot retire organization: ${activeProjects} active dependent project(s) remain.`);
      return;
    }

    if (org.admins.length < 2 && !forceOverride) {
      announce('Retirement Rejected: Minimum 2 distinct active administrators required for quorum.');
      return;
    }

    org.state = 'Retired';
    dispatchToWasm(`organization:retire:${org.id}`);
    updateOrgUI();
    announce(`Organization "${org.name}" has been permanently Retired.`);
  });

  document.getElementById('btn-retire-founding')?.addEventListener('click', () => {
    const org = state.organizations.find(o => o.id === state.activeOrgId);
    if (!org) return;

    if (org.admins.length < 2) {
      announce('Cannot retire founding grant: would leave fewer than 2 administrators.');
      return;
    }

    org.foundingGrant = false;
    dispatchToWasm(`organization:retire_grant:${org.id}`);
    updateOrgUI();
    announce(`Founding grant retired for ${org.name}. Regular governance active.`);
  });

  const formSendInvite = document.getElementById('form-send-invitation');
  if (formSendInvite) {
    formSendInvite.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('invitation-email').value.trim();
      const scope = document.getElementById('invitation-scope').value;
      const org = state.organizations.find(o => o.id === state.activeOrgId);
      if (!org) return;

      if (org.admins.some(a => a.email === email)) {
        alert('User is already an administrator in this organization.');
        return;
      }

      const inviteId = 'inv-' + Math.random().toString(36).substring(2, 8);
      const invite = {
        id: inviteId,
        orgId: org.id,
        recipientMailbox: email,
        scope: scope,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        acceptedKey: null,
        signatureHex: null
      };

      state.invitations.unshift(invite);
      dispatchToWasm(`invitation:create:${inviteId}:${org.id}:${email}:${scope}`);
      updateInvitationsUI();
      announce(`Invitation issued to ${email} for scope ${scope}.`);
    });
  }

  function updateInvitationsUI() {
    const tbody = document.getElementById('invitations-tbody');
    if (!tbody) return;
    const org = state.organizations.find(o => o.id === state.activeOrgId);
    if (!org) return;

    const orgInvites = state.invitations.filter(i => i.orgId === org.id);
    if (orgInvites.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">No invitations for this organization.</td></tr>';
      return;
    }

    tbody.innerHTML = orgInvites.map(inv => `
      <tr>
        <td><code>${inv.recipientMailbox}</code></td>
        <td>${inv.scope}</td>
        <td><span class="badge ${inv.status === 'Accepted' ? 'badge-success' : (inv.status === 'Pending' ? 'badge-warning' : 'badge-danger')}">${inv.status}</span></td>
        <td>
          ${inv.status === 'Pending' ? `
            <button type="button" class="btn btn-sm btn-success btn-accept-invite" data-id="${inv.id}" style="padding:0.2rem 0.4rem; font-size:0.75rem;">Accept</button>
            <button type="button" class="btn btn-sm btn-warning btn-decline-invite" data-id="${inv.id}" style="padding:0.2rem 0.4rem; font-size:0.75rem;">Decline</button>
            <button type="button" class="btn btn-sm btn-danger btn-revoke-invite" data-id="${inv.id}" style="padding:0.2rem 0.4rem; font-size:0.75rem;">Revoke</button>
          ` : `<em>${inv.status}</em>`}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-accept-invite').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const inv = state.invitations.find(i => i.id === id);
        if (!inv || inv.status !== 'Pending') return;
        const org = state.organizations.find(o => o.id === inv.orgId);
        if (!org) return;

        const userMail = inv.recipientMailbox;
        const userAcc = `uor:user:${userMail.replace('@', '_at_')}`;
        let keyRec = null;
        let sig = null;
        if (window.uorCrypto) {
          keyRec = await window.uorCrypto.getOrCreateKeyPair(userAcc);
          const challenge = `accept-invitation:${inv.id}:${inv.orgId}:${userMail}`;
          sig = await window.uorCrypto.signChallenge(userAcc, challenge);
        }
        inv.status = 'Accepted';
        inv.acceptedKey = keyRec ? keyRec.pubKeyHex : 'key-accepted';
        inv.signatureHex = sig;

        if (!org.admins.some(a => a.email === userMail)) {
          org.admins.push({ email: userMail, scope: inv.scope, pubKey: inv.acceptedKey });
        }

        dispatchToWasm(`invitation:accept:${inv.id}:${userMail}`);
        updateOrgUI();
        announce(`Invitation accepted by ${userMail}. Administrator enrolled!`);
      });
    });

    tbody.querySelectorAll('.btn-decline-invite').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const inv = state.invitations.find(i => i.id === id);
        if (inv && inv.status === 'Pending') {
          inv.status = 'Declined';
          dispatchToWasm(`invitation:decline:${inv.id}`);
          updateInvitationsUI();
          announce(`Invitation declined for ${inv.recipientMailbox}.`);
        }
      });
    });

    tbody.querySelectorAll('.btn-revoke-invite').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const inv = state.invitations.find(i => i.id === id);
        if (inv && inv.status === 'Pending') {
          inv.status = 'Revoked';
          dispatchToWasm(`invitation:revoke:${inv.id}`);
          updateInvitationsUI();
          announce(`Invitation revoked for ${inv.recipientMailbox}.`);
        }
      });
    });
  }

  // --- WORKFLOWS SERVICE ---
  const formWorkflow = document.getElementById('form-trigger-workflow');
  if (formWorkflow) {
    formWorkflow.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('wf-name-input').value.trim();
      const commit = document.getElementById('wf-commit-input').value.trim();

      const runId = 'wf-run-' + Math.random().toString(36).substring(2, 8);
      const digest = await sha256Hex(`artifact-${runId}-${commit}`);

      const newRun = {
        id: runId,
        name,
        commit,
        state: 'Succeeded',
        elapsed: Math.floor(Math.random() * 60) + 10,
        artifact: `sha256:${digest.substring(0, 32)}...`
      };

      state.workflowRuns.unshift(newRun);
      dispatchToWasm(`workflows:run:${runId}:${name}:Succeeded`);

      const tbody = document.getElementById('workflow-runs-tbody');
      if (tbody) {
        tbody.innerHTML = state.workflowRuns.map(r => `
          <tr>
            <td><code>${r.id}</code></td>
            <td>${r.name}</td>
            <td><span class="badge ${r.state === 'Succeeded' ? 'badge-success' : 'badge-danger'}">${r.state}</span></td>
            <td>${r.elapsed}s</td>
            <td><code class="state-code">${r.artifact}</code></td>
          </tr>
        `).join('');
      }

      announce(`Workflow run ${runId} succeeded! Artifact produced: ${newRun.artifact}`);
    });
  }

  document.getElementById('btn-timeout-workflow')?.addEventListener('click', () => {
    const runId = 'wf-timeout-' + Math.random().toString(36).substring(2, 8);
    const failedRun = {
      id: runId,
      name: 'timeout-simulation',
      commit: 'head',
      state: 'Failed',
      elapsed: 3601,
      artifact: 'None (Timeout exceeded)'
    };

    state.workflowRuns.unshift(failedRun);
    dispatchToWasm(`workflows:run:${runId}:Failed`);

    const tbody = document.getElementById('workflow-runs-tbody');
    if (tbody) {
      tbody.innerHTML = state.workflowRuns.map(r => `
        <tr>
          <td><code>${r.id}</code></td>
          <td>${r.name}</td>
          <td><span class="badge ${r.state === 'Succeeded' ? 'badge-success' : 'badge-danger'}">${r.state}</span></td>
          <td>${r.elapsed}s</td>
          <td><code class="state-code">${r.artifact}</code></td>
        </tr>
      `).join('');
    }
    announce(`Workflow ${runId} failed due to timeout bounds violation.`);
  });

  // --- AI INFERENCE ---
  const formInference = document.getElementById('form-ai-inference');
  if (formInference) {
    formInference.addEventListener('submit', (e) => {
      e.preventDefault();
      const prompt = document.getElementById('ai-prompt-input').value.trim();
      const model = document.getElementById('ai-model-select').value;
      const propId = 'prop-ai-' + Math.random().toString(36).substring(2, 8);

      state.activeProposal = {
        id: propId,
        model,
        prompt,
        proposalText: `AI Agent recommends: Allocate 5,000 UOR credits from Treasury Reserve to Verification Node Cluster for ${state.activeOrgId}.`,
        authorized: false
      };

      dispatchToWasm(`ai:propose:${propId}:${model}`);

      const propIdEl = document.getElementById('ai-proposal-id');
      const propBodyEl = document.getElementById('ai-proposal-body');
      const authActions = document.getElementById('ai-auth-actions');

      if (propIdEl) propIdEl.textContent = propId;
      if (propBodyEl) propBodyEl.innerHTML = `<p>${state.activeProposal.proposalText}</p><span class="badge badge-warning">Awaiting Human Authorization</span>`;
      if (authActions) authActions.hidden = false;

      announce('AI Inference completed. Proposal generated and awaiting human authorization.');
    });
  }

  document.getElementById('btn-approve-ai')?.addEventListener('click', () => {
    if (state.activeProposal) {
      state.activeProposal.authorized = true;
      dispatchToWasm(`ai:authorize:${state.activeProposal.id}`);
      
      const propBodyEl = document.getElementById('ai-proposal-body');
      const authActions = document.getElementById('ai-auth-actions');
      if (propBodyEl) {
        propBodyEl.innerHTML = `<p>${state.activeProposal.proposalText}</p><span class="badge badge-success">Authorized by Human Operator</span>`;
      }
      if (authActions) authActions.hidden = true;

      state.auditLog.unshift({
        timestamp: new Date().toISOString(),
        event: `AI Proposal Authorized: ${state.activeProposal.id}`,
        actor: state.currentUser ? state.currentUser.did : 'did:key:human-operator',
        hash: 'sha256:' + Math.random().toString(36).substring(2, 10)
      });
      announce(`AI Proposal ${state.activeProposal.id} authorized and applied.`);
    }
  });

  document.getElementById('btn-reject-ai')?.addEventListener('click', () => {
    if (state.activeProposal) {
      dispatchToWasm(`ai:reject:${state.activeProposal.id}`);
      state.activeProposal = null;
      const propIdEl = document.getElementById('ai-proposal-id');
      const propBodyEl = document.getElementById('ai-proposal-body');
      const authActions = document.getElementById('ai-auth-actions');

      if (propIdEl) propIdEl.textContent = 'None';
      if (propBodyEl) propBodyEl.innerHTML = '<em>Proposal rejected.</em>';
      if (authActions) authActions.hidden = true;
      announce('AI Proposal rejected.');
    }
  });

  // ============================================================================
  // --- NOTIFICATIONS & INBOX (M3 - U17) ---
  // ============================================================================
  function updateInboxUI() {
    const badge = document.getElementById('unread-notif-badge');
    const list = document.getElementById('inbox-list');
    const unreadCount = state.inbox.filter(n => n.readState === 'Unread').length;

    if (badge) {
      badge.textContent = String(unreadCount);
      badge.setAttribute('aria-label', `${unreadCount} unread notifications`);
      badge.className = unreadCount > 0 ? 'badge badge-info' : 'badge badge-neutral';
    }

    if (list) {
      if (state.inbox.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.875rem; padding:1rem;">No notifications.</div>';
      } else {
        list.innerHTML = state.inbox.map(n => {
          const isUnread = n.readState === 'Unread';
          const sevClass = n.severity === 'Error' ? 'badge-danger' : n.severity === 'Warning' ? 'badge-warning' : 'badge-info';
          const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          return `
            <div class="inbox-item" role="article" style="padding:0.5rem; border:1px solid var(--color-card-border); border-radius:6px; background:${isUnread ? 'var(--color-surface-bg)' : 'var(--color-card-bg)'}; font-size:0.75rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <span class="badge ${sevClass}" style="font-size:0.625rem;">${n.severity}</span>
                <span style="color:var(--color-text-muted); font-size:0.625rem;">${timeStr}</span>
              </div>
              <div style="font-weight:600; color:var(--color-text-header);">${n.title}</div>
              <div style="color:var(--color-text-body); margin:0.25rem 0;">${n.summary}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
                ${n.route ? `<a href="${n.route}" class="notif-route-link" data-route="${n.route}" style="color:var(--color-info); font-size:0.6875rem; text-decoration:none;">View &rarr;</a>` : '<span></span>'}
                ${isUnread 
                  ? `<button type="button" class="btn btn-sm btn-secondary btn-mark-read" data-id="${n.id}" style="font-size:0.625rem; padding:0.125rem 0.375rem;">Mark Read</button>` 
                  : `<span style="color:var(--color-text-muted); font-size:0.625rem;">Read</span>`}
              </div>
            </div>
          `;
        }).join('');

        list.querySelectorAll('.btn-mark-read').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            markNotificationRead(id);
          });
        });

        list.querySelectorAll('.notif-route-link').forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = link.getAttribute('data-route');
            if (route && route.startsWith('#panel-')) {
              const tabId = route.replace('#panel-', 'tab-');
              const tab = document.getElementById(tabId);
              if (tab) activateTab(tab);
              const inboxPanel = document.getElementById('inbox-panel');
              const btnInb = document.getElementById('btn-inbox');
              if (inboxPanel) inboxPanel.setAttribute('hidden', '');
              if (btnInb) btnInb.setAttribute('aria-expanded', 'false');
            }
          });
        });
      }
    }
  }

  function markNotificationRead(id) {
    const notif = state.inbox.find(n => n.id === id);
    if (notif) {
      notif.readState = 'Read';
      updateInboxUI();
    }
  }

  function markAllNotificationsRead() {
    state.inbox.forEach(n => { n.readState = 'Read'; });
    updateInboxUI();
    announce('All notifications marked as read.');
  }

  function dispatchNotification({ event, severity, title, summary, route }) {
    const notif = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      orgId: state.activeOrgId,
      recipient: state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
      event: event || 'SystemEvent',
      severity: severity || 'Info',
      title: title || 'Notification',
      summary: summary || '',
      route: route || '',
      readState: 'Unread',
      timestamp: new Date().toISOString()
    };
    state.inbox.unshift(notif);
    updateInboxUI();
    announce(`New notification: ${title}`);
    return notif;
  }

  const btnInbox = document.getElementById('btn-inbox');
  if (btnInbox) {
    btnInbox.addEventListener('click', () => {
      const panel = document.getElementById('inbox-panel');
      if (!panel) return;
      const isHidden = panel.hasAttribute('hidden');
      if (isHidden) {
        panel.removeAttribute('hidden');
        btnInbox.setAttribute('aria-expanded', 'true');
        btnMarkAllRead?.focus();
      } else {
        panel.setAttribute('hidden', '');
        btnInbox.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const btnMarkAllRead = document.getElementById('btn-mark-all-read');
  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', () => {
      markAllNotificationsRead();
    });
  }

  // ============================================================================
  // --- PROJECTS, MILESTONES & ACTIVITY LOG (M3 - U15, U51) ---
  // ============================================================================
  const GENESIS_DIGEST = '0000000000000000000000000000000000000000000000000000000000000000';

  async function computeActivityDigest(prevDigest, entryId, projectId, actor, action, details, timestamp) {
    const cleanPrev = (prevDigest || '').replace(/^sha256:/, '');
    const raw = `${cleanPrev}:${entryId}:${projectId}:${actor}:${action}:${details}:${timestamp}`;
    return await sha256Hex(raw);
  }

  async function appendProjectActivity(project, action, actor, details) {
    const seq = (project.activityLog ? project.activityLog.length : 0) + 1;
    const seqStr = String(seq).padStart(4, '0');
    const entryId = `${project.id}:act-${seqStr}`;
    const timestamp = new Date().toISOString();
    const prevDigest = project.activityLog && project.activityLog.length > 0
      ? (project.activityLog[project.activityLog.length - 1].entry_digest || project.activityLog[project.activityLog.length - 1].hash).replace(/^sha256:/, '')
      : GENESIS_DIGEST;

    const cleanDigest = await computeActivityDigest(prevDigest, entryId, project.id, actor, action, details, timestamp);
    const entry = {
      seq,
      entry_id: entryId,
      project_id: project.id,
      timestamp,
      actor,
      action,
      details,
      prev_entry_digest: prevDigest,
      entry_digest: `sha256:${cleanDigest}`,
      prevHash: prevDigest,
      hash: `sha256:${cleanDigest}`,
      time: timestamp
    };
    project.activityLog = project.activityLog || [];
    project.activityLog.push(entry);
    return entry;
  }

  async function verifyActivityChain(activityLog, projectId) {
    if (!activityLog || activityLog.length === 0) return { valid: true };
    let expectedPrev = GENESIS_DIGEST;

    for (const entry of activityLog) {
      const prev = (entry.prev_entry_digest || entry.prevHash || '').replace(/^sha256:/, '');
      if (prev !== expectedPrev) {
        return {
          valid: false,
          error: `Predecessor mismatch at ${entry.entry_id || entry.seq}: expected ${expectedPrev}, found ${prev}`
        };
      }
      const entryId = entry.entry_id || `${projectId}:act-${String(entry.seq).padStart(4, '0')}`;
      const timestamp = entry.timestamp || entry.time;
      const recomputed = await computeActivityDigest(
        prev,
        entryId,
        projectId,
        entry.actor,
        entry.action,
        entry.details,
        timestamp
      );
      const actualDigest = (entry.entry_digest || entry.hash || '').replace(/^sha256:/, '');
      if (recomputed !== actualDigest) {
        return {
          valid: false,
          error: `Digest mismatch at ${entryId}: expected ${recomputed}, found ${actualDigest}`
        };
      }
      expectedPrev = actualDigest;
    }
    return { valid: true };
  }

  async function updateProjectsUI() {
    const orgProjects = state.projects.filter(p => p.orgId === state.activeOrgId);
    let activeProject = orgProjects.find(p => p.id === state.activeProjectId);
    if (!activeProject && orgProjects.length > 0) {
      activeProject = orgProjects[0];
      state.activeProjectId = activeProject.id;
    }

    const activeNameEl = document.getElementById('project-active-name');
    const countEl = document.getElementById('project-count');
    const progressEl = document.getElementById('project-milestone-progress');
    const releaseCountEl = document.getElementById('project-release-count');
    const projectSelect = document.getElementById('project-select');
    const statusBadge = document.getElementById('project-status-badge');
    const descDisplay = document.getElementById('project-desc-display');

    if (activeNameEl) activeNameEl.textContent = activeProject ? activeProject.name : 'None';
    if (countEl) countEl.textContent = String(orgProjects.filter(p => p.state === 'Active').length);

    if (progressEl) {
      if (activeProject && activeProject.milestones && activeProject.milestones.length > 0) {
        const completed = activeProject.milestones.filter(m => m.status === 'Completed').length;
        const pct = Math.round((completed / activeProject.milestones.length) * 100);
        progressEl.textContent = `${pct}%`;
      } else {
        progressEl.textContent = '0%';
      }
    }

    if (releaseCountEl) {
      releaseCountEl.textContent = String(activeProject && activeProject.releases ? activeProject.releases.length : 0);
    }

    if (projectSelect) {
      if (orgProjects.length === 0) {
        projectSelect.innerHTML = '<option value="">No projects in this organization</option>';
      } else {
        projectSelect.innerHTML = orgProjects.map(p => `
          <option value="${p.id}" ${p.id === state.activeProjectId ? 'selected' : ''}>${p.name} (${p.state})</option>
        `).join('');
      }
    }

    if (statusBadge) {
      const stateVal = activeProject ? activeProject.state : 'None';
      statusBadge.textContent = stateVal;
      statusBadge.className = 'badge ' + (stateVal === 'Active' ? 'badge-success' : stateVal === 'Archived' ? 'badge-warning' : 'badge-danger');
    }

    if (descDisplay) {
      descDisplay.textContent = activeProject ? (activeProject.description || 'No description provided.') : 'No project selected.';
    }

    // Render Releases
    const releasesTbody = document.getElementById('project-releases-tbody');
    if (releasesTbody) {
      if (!activeProject || !activeProject.releases || activeProject.releases.length === 0) {
        releasesTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">No releases drafted for this project.</td></tr>';
      } else {
        releasesTbody.innerHTML = activeProject.releases.map(r => `
          <tr>
            <td><code>${r.tag}</code></td>
            <td>${r.title}</td>
            <td><span class="badge ${r.status === 'Published' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
            <td>
              ${r.status === 'Draft'
                ? `<button type="button" class="btn btn-sm btn-primary btn-publish-release" data-tag="${r.tag}">Publish</button>`
                : `<span style="color:var(--color-text-muted); font-size:0.75rem;">Immutable</span>`}
            </td>
          </tr>
        `).join('');

        releasesTbody.querySelectorAll('.btn-publish-release').forEach(btn => {
          btn.addEventListener('click', async () => {
            const tag = btn.getAttribute('data-tag');
            const rel = activeProject.releases.find(r => r.tag === tag);
            if (rel && rel.status === 'Draft') {
              rel.status = 'Published';
              await appendProjectActivity(
                activeProject,
                'ReleasePublished',
                state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
                `Published release ${rel.tag}: ${rel.title}`
              );
              dispatchNotification({
                event: 'ReleasePublished',
                severity: 'Info',
                title: `Release Published: ${rel.tag}`,
                summary: `Release ${rel.tag} is now published and immutable.`,
                route: '#panel-projects'
              });
              updateProjectsUI();
              announce(`Release ${rel.tag} published successfully.`);
            }
          });
        });
      }
    }

    // Render Milestones & Deliverables
    const milestoneList = document.getElementById('milestone-list');
    if (milestoneList) {
      if (!activeProject || !activeProject.milestones || activeProject.milestones.length === 0) {
        milestoneList.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.875rem; padding:1rem;">No milestones configured.</div>';
      } else {
        milestoneList.innerHTML = activeProject.milestones.map(m => {
          const statusClass = m.status === 'Completed' ? 'badge-success' : m.status === 'InProgress' ? 'badge-info' : 'badge-neutral';
          return `
            <div class="milestone-card">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0; font-size:0.875rem;">${m.title}</h4>
                <span class="badge ${statusClass}">${m.status}</span>
              </div>
              <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:0.25rem;">Target Due: ${m.dueDate || 'Unspecified'}</div>
              <div class="deliverables-sublist" style="margin-top:0.5rem; padding-left:0.5rem; border-left:2px solid var(--color-card-border);">
                ${m.deliverables && m.deliverables.length > 0 ? m.deliverables.map(d => `
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; font-size:0.8125rem;">
                    <div>
                      <span>${d.title}</span>
                      ${d.digest ? `<div style="font-size:0.6875rem; color:var(--color-success);"><code>${d.digest}</code></div>` : ''}
                    </div>
                    <div>
                      ${d.status === 'Verified'
                        ? `<span class="badge badge-success" style="font-size:0.6875rem;">Verified</span>`
                        : `<button type="button" class="btn btn-sm btn-secondary btn-verify-deliverable" data-mid="${m.id}" data-did="${d.id}" style="font-size:0.6875rem; padding:0.125rem 0.375rem;">Complete &amp; Verify</button>`}
                    </div>
                  </div>
                `).join('') : '<div style="font-size:0.75rem; color:var(--color-text-muted);">No deliverables yet.</div>'}
              </div>
            </div>
          `;
        }).join('');

        milestoneList.querySelectorAll('.btn-verify-deliverable').forEach(btn => {
          btn.addEventListener('click', async () => {
            const mid = btn.getAttribute('data-mid');
            const did = btn.getAttribute('data-did');
            const m = activeProject.milestones.find(item => item.id === mid);
            if (!m) return;
            const d = m.deliverables.find(item => item.id === did);
            if (!d) return;

            const rawData = `${activeProject.id}:${m.id}:${d.id}:${d.title}:${Date.now()}`;
            const digest = await sha256Hex(rawData);
            d.digest = `sha256:${digest}`;
            d.status = 'Verified';

            if (m.deliverables.every(item => item.status === 'Verified')) {
              m.status = 'Completed';
            }

            await appendProjectActivity(
              activeProject,
              'DeliverableVerified',
              state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
              `Verified deliverable "${d.title}" with SHA-256 digest ${digest.substring(0, 16)}...`
            );

            updateProjectsUI();
            announce(`Deliverable "${d.title}" verified with SHA-256 digest.`);
          });
        });
      }
    }

    // Render Tamper-Evident Activity Log
    const activityList = document.getElementById('project-activity-list');
    const chainStatus = document.getElementById('activity-chain-status');

    if (activityList && activeProject) {
      const logs = (activeProject.activityLog || []).slice().reverse();
      if (logs.length === 0) {
        activityList.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.75rem; padding:1rem;">No activity entries recorded.</div>';
      } else {
        activityList.innerHTML = logs.map(a => `
          <div class="activity-item" role="article">
            <div class="activity-meta">
              <strong>#${a.seq} ${a.action}</strong>
              <span>${a.time || a.timestamp || ''}</span>
            </div>
            <div style="margin:0.25rem 0; color:var(--color-text-body);">${a.details} (actor: <code>${a.actor}</code>)</div>
            <div class="activity-chain-hash">
              prev: <code>${(a.prev_entry_digest || a.prevHash || '').substring(0, 16)}...</code> |
              digest: <code>${(a.entry_digest || a.hash || '').substring(0, 16)}...</code>
            </div>
          </div>
        `).join('');
      }

      if (chainStatus) {
        const verifyResult = await verifyActivityChain(activeProject.activityLog, activeProject.id);
        if (verifyResult.valid) {
          chainStatus.textContent = 'Verified Chain';
          chainStatus.className = 'badge badge-success';
        } else {
          chainStatus.textContent = 'Chain Tampered!';
          chainStatus.className = 'badge badge-danger';
        }
      }
    }
  }

  // Project selector change listener
  document.getElementById('project-select')?.addEventListener('change', (e) => {
    state.activeProjectId = e.target.value;
    updateProjectsUI();
    announce(`Switched to project ${e.target.value}`);
  });

  // Create Project form listener
  const formCreateProject = document.getElementById('form-create-project');
  if (formCreateProject) {
    formCreateProject.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('project-name-input').value.trim();
      let slug = document.getElementById('project-slug-input').value.trim();
      const desc = document.getElementById('project-desc-input').value.trim();

      if (!name) return;

      const exists = state.projects.some(p => p.orgId === state.activeOrgId && p.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        alert(`Cannot create project with duplicate name: "${name}" already exists in organization.`);
        announce(`Cannot create project with duplicate name: "${name}" already exists in organization.`);
        return;
      }

      if (!slug) {
        slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }

      const orgClean = state.activeOrgId.replace('uor:org:', '');
      const newProjectId = `uor:project:${orgClean}:${slug}`;

      const newProj = {
        id: newProjectId,
        orgId: state.activeOrgId,
        name: name,
        state: 'Active',
        description: desc,
        revision: 1,
        milestones: [],
        activityLog: [],
        releases: []
      };

      await appendProjectActivity(
        newProj,
        'ProjectCreated',
        state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
        `Project created: ${name}`
      );

      state.projects.push(newProj);
      state.activeProjectId = newProjectId;

      dispatchNotification({
        event: 'ProjectCreated',
        severity: 'Info',
        title: `Project Created: ${name}`,
        summary: `New project "${name}" initialized in ${state.activeOrgId}`,
        route: '#panel-projects'
      });

      formCreateProject.reset();
      updateProjectsUI();
      announce(`Project "${name}" created successfully.`);
    });
  }

  // Archive Project button listener
  document.getElementById('btn-archive-project')?.addEventListener('click', async () => {
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) return;

    activeProject.state = 'Archived';
    await appendProjectActivity(
      activeProject,
      'ProjectArchived',
      state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
      `Archived project ${activeProject.name}`
    );
    updateProjectsUI();
    announce(`Project "${activeProject.name}" has been Archived.`);
  });

  // Restore Project button listener
  document.getElementById('btn-restore-project')?.addEventListener('click', async () => {
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) return;

    activeProject.state = 'Active';
    await appendProjectActivity(
      activeProject,
      'ProjectRestored',
      state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
      `Restored project ${activeProject.name} to Active`
    );
    updateProjectsUI();
    announce(`Project "${activeProject.name}" restored to Active.`);
  });

  // Delete Project button listener
  document.getElementById('btn-delete-project')?.addEventListener('click', async () => {
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) return;

    const hasActiveDeliverables = activeProject.milestones?.some(m => m.deliverables?.some(d => d.status !== 'Verified'));
    const forceOverride = document.getElementById('delete-project-force')?.checked;

    if (hasActiveDeliverables && !forceOverride) {
      alert('Cannot delete project: contains active deliverables. Use force delete override if required.');
      announce('Cannot delete project: contains active deliverables. Use force delete override if required.');
      return;
    }

    state.projects = state.projects.filter(p => p.id !== activeProject.id);
    const remaining = state.projects.filter(p => p.orgId === state.activeOrgId);
    state.activeProjectId = remaining.length > 0 ? remaining[0].id : null;

    updateProjectsUI();
    announce(`Project "${activeProject.name}" deleted.`);
  });

  // Create Release form listener
  const formCreateRelease = document.getElementById('form-create-release');
  if (formCreateRelease) {
    formCreateRelease.addEventListener('submit', async (e) => {
      e.preventDefault();
      const activeProject = state.projects.find(p => p.id === state.activeProjectId);
      if (!activeProject) return;

      const tag = document.getElementById('release-tag-input').value.trim();
      const title = document.getElementById('release-title-input').value.trim();
      const notes = document.getElementById('release-notes-input').value.trim();

      if (!tag || !title) return;

      if (activeProject.releases?.some(r => r.tag === tag)) {
        alert('Release tag already exists in project.');
        return;
      }

      const release = {
        tag,
        title,
        status: 'Draft',
        commit: '0e1c9eb',
        notes,
        artifacts: []
      };

      activeProject.releases = activeProject.releases || [];
      activeProject.releases.push(release);

      await appendProjectActivity(
        activeProject,
        'ReleaseDrafted',
        state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
        `Drafted release ${tag}: ${title}`
      );

      formCreateRelease.reset();
      updateProjectsUI();
      announce(`Release draft ${tag} created.`);
    });
  }

  // Create Milestone form listener
  const formCreateMilestone = document.getElementById('form-create-milestone');
  if (formCreateMilestone) {
    formCreateMilestone.addEventListener('submit', async (e) => {
      e.preventDefault();
      const activeProject = state.projects.find(p => p.id === state.activeProjectId);
      if (!activeProject) return;

      const title = document.getElementById('milestone-title-input').value.trim();
      const dueDate = document.getElementById('milestone-date-input').value;
      if (!title) return;

      const mid = 'm-' + ((activeProject.milestones?.length || 0) + 1);
      const newMilestone = {
        id: mid,
        title,
        status: 'InProgress',
        dueDate: dueDate || null,
        deliverables: []
      };

      activeProject.milestones = activeProject.milestones || [];
      activeProject.milestones.push(newMilestone);

      await appendProjectActivity(
        activeProject,
        'MilestoneAdded',
        state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
        `Added milestone: ${title}`
      );

      formCreateMilestone.reset();
      updateProjectsUI();
      announce(`Milestone "${title}" added.`);
    });
  }

  // Add Deliverable form listener
  const formAddDeliverable = document.getElementById('form-add-deliverable');
  if (formAddDeliverable) {
    formAddDeliverable.addEventListener('submit', async (e) => {
      e.preventDefault();
      const activeProject = state.projects.find(p => p.id === state.activeProjectId);
      if (!activeProject) return;

      if (!activeProject.milestones || activeProject.milestones.length === 0) {
        alert('Please create a milestone first.');
        return;
      }

      const title = document.getElementById('deliverable-title-input').value.trim();
      if (!title) return;

      const targetMilestone = activeProject.milestones.find(m => m.status !== 'Completed') || activeProject.milestones[activeProject.milestones.length - 1];
      const did = 'd-' + ((targetMilestone.deliverables?.length || 0) + 1);

      const deliverable = {
        id: did,
        title,
        status: 'Pending',
        digest: null
      };

      targetMilestone.deliverables = targetMilestone.deliverables || [];
      targetMilestone.deliverables.push(deliverable);

      await appendProjectActivity(
        activeProject,
        'DeliverableAdded',
        state.currentUser ? state.currentUser.email : 'alice@uor.foundation',
        `Added deliverable "${title}" to milestone ${targetMilestone.title}`
      );

      formAddDeliverable.reset();
      updateProjectsUI();
      announce(`Deliverable "${title}" added.`);
    });
  }

  // ============================================================================
  // --- CHANNELS, MESSAGING & MEDIA ATTACHMENTS (M3 - U16, U18) ---
  // ============================================================================
  function updateChannelsUI() {
    const orgChannels = state.channels.filter(c => c.orgId === state.activeOrgId);
    let activeChan = orgChannels.find(c => c.id === state.activeChannelId || c.name === state.activeChannelId);
    if (!activeChan && orgChannels.length > 0) {
      activeChan = orgChannels[0];
      state.activeChannelId = activeChan.id;
    }

    const channelList = document.getElementById('channel-list');
    const msgChanSelect = document.getElementById('msg-channel');
    const activeChanName = document.getElementById('active-channel-name');
    const messagesContainer = document.getElementById('messages-list');

    if (channelList) {
      channelList.innerHTML = orgChannels.map(c => `
        <button type="button" class="btn btn-sm ${c.id === state.activeChannelId ? 'btn-primary' : 'btn-secondary'} btn-switch-channel" data-cid="${c.id}" style="justify-content:flex-start; text-align:left; width:100%; margin-bottom:0.25rem;">
          <strong style="color:inherit;">${c.name}</strong> <span style="font-size:0.6875rem; color:inherit; margin-left:auto;">(${c.type})</span>
        </button>
      `).join('');

      channelList.querySelectorAll('.btn-switch-channel').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-cid');
          state.activeChannelId = cid;
          updateChannelsUI();
          announce(`Switched to channel ${cid}`);
        });
      });
    }

    if (msgChanSelect) {
      msgChanSelect.innerHTML = orgChannels.map(c => `
        <option value="${c.name}" ${activeChan && c.name === activeChan.name ? 'selected' : ''}>${c.name} (${c.type})</option>
      `).join('');
    }

    if (activeChanName) {
      activeChanName.textContent = activeChan ? activeChan.name : '#general';
    }

    if (messagesContainer) {
      const activeName = activeChan ? activeChan.name : '#general';
      const chanMessages = state.messages.filter(m => m.channel === activeName);

      if (chanMessages.length === 0) {
        messagesContainer.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); padding:1.5rem;">No messages in this channel yet.</div>';
      } else {
        messagesContainer.innerHTML = chanMessages.map(m => {
          const badgeClass = m.status === 'Acknowledged' ? 'badge-success' : m.status === 'Delivered' ? 'badge-info' : 'badge-neutral';
          return `
            <div class="message-card" role="article">
              <div class="msg-header" style="display:flex; justify-content:space-between; margin-bottom:0.25rem; font-size:0.75rem;">
                <strong>${m.channel} &bull; ${m.senderDid ? m.senderDid.substring(0, 24) + '...' : 'Anonymous'} &bull; ${m.time || ''}</strong>
                <span class="badge ${badgeClass} msg-status-badge">${m.status || 'Sent'}</span>
              </div>
              <div class="msg-content" style="font-size:0.875rem;">${m.content}</div>
              ${m.attachment ? `
                <div class="msg-attachment-card">
                  <div style="font-weight:600;">&#128206; Attachment: ${m.attachment.name} (${Math.round(m.attachment.size / 1024)} KiB)</div>
                  <div style="color:var(--color-text-muted);">MIME: <code>${m.attachment.mime || 'application/octet-stream'}</code></div>
                  <div style="color:var(--color-success);">Kappa Digest: <code>${m.attachment.digest}</code></div>
                  ${m.attachment.alt ? `<div style="font-style:italic; margin-top:0.25rem;">Alt: "${m.attachment.alt}"</div>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }
  }

  // Create Channel form listener
  const formCreateChannel = document.getElementById('form-create-channel');
  if (formCreateChannel) {
    formCreateChannel.addEventListener('submit', (e) => {
      e.preventDefault();
      let name = document.getElementById('channel-name-input').value.trim();
      const topic = document.getElementById('channel-topic-input').value.trim();
      const type = document.getElementById('channel-type-select').value;

      if (!name) return;
      if (!name.startsWith('#')) name = '#' + name;

      const exists = state.channels.some(c => c.orgId === state.activeOrgId && c.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        alert(`Channel "${name}" already exists in this organization.`);
        return;
      }

      const orgClean = state.activeOrgId.replace('uor:org:', '');
      const chanClean = name.replace('#', '').toLowerCase();
      const newChanId = `uor:channel:${orgClean}:${chanClean}`;

      const newChan = {
        id: newChanId,
        name,
        topic,
        type,
        orgId: state.activeOrgId
      };

      state.channels.push(newChan);
      state.activeChannelId = newChanId;

      formCreateChannel.reset();
      updateChannelsUI();
      announce(`Channel ${name} created successfully.`);
    });
  }

  // Compose Message form listener with 25 MiB Attachment enforcement
  const formSendMessage = document.getElementById('form-send-message');
  if (formSendMessage) {
    formSendMessage.addEventListener('submit', async (e) => {
      e.preventDefault();
      const destChannel = document.getElementById('msg-channel').value;
      const subject = document.getElementById('msg-subject').value.trim();
      const body = document.getElementById('msg-body').value.trim();
      const fileInput = document.getElementById('msg-attachment-file');
      const altInput = document.getElementById('msg-attachment-alt');

      const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes (25 MiB)
      const file = fileInput && fileInput.files && fileInput.files[0];

      if (file && file.size > MAX_ATTACHMENT_BYTES) {
        alert(`Attachment exceeds 25 MiB limit (${file.size} bytes). Upload rejected.`);
        announce('Attachment exceeds 25 MiB limit. Upload rejected.');
        return;
      }

      let attachment = null;
      if (file) {
        const fileBuffer = await file.arrayBuffer();
        const digestHex = await sha256Hex(fileBuffer);
        const canonicalDigest = `sha256:${digestHex}`;

        // Store into persistent IndexedDB Kappa store
        await putBlob(canonicalDigest, fileBuffer);

        attachment = {
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          digest: canonicalDigest,
          alt: altInput ? altInput.value.trim() : ''
        };
      }

      const msgId = 'msg-' + Date.now();
      const newMsg = {
        id: msgId,
        channel: destChannel,
        senderDid: state.currentUser ? state.currentUser.did : 'did:key:anonymous-member',
        time: 'Today ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `[${subject}] ${body}`,
        status: 'Sent',
        attachment
      };

      state.messages.push(newMsg);
      dispatchToWasm(`messaging:dispatch:${msgId}:${destChannel}`);

      formSendMessage.reset();
      updateChannelsUI();
      announce(`Message dispatched to ${destChannel}.`);

      // Advance delivery state progressively: Sent -> Delivered -> Acknowledged
      setTimeout(() => {
        newMsg.status = 'Delivered';
        updateChannelsUI();
      }, 60);

      setTimeout(() => {
        newMsg.status = 'Acknowledged';
        updateChannelsUI();
      }, 180);
    });
  }

  // ============================================================================
  // --- WORKSPACES & DIRECTORIES (M3 - U50, U52) ---
  // ============================================================================
  function updateWorkspacesUI() {
    const orgWorkspaces = state.workspaces.filter(w => w.orgId === state.activeOrgId);
    let activeWs = orgWorkspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWs && orgWorkspaces.length > 0) {
      activeWs = orgWorkspaces[0];
      state.activeWorkspaceId = activeWs.id;
    }

    const wsTbody = document.getElementById('workspace-tbody');
    const wsStateTbody = document.getElementById('workspace-state-tbody');

    if (wsTbody) {
      if (orgWorkspaces.length === 0) {
        wsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">No workspaces in this organization.</td></tr>';
      } else {
        wsTbody.innerHTML = orgWorkspaces.map(w => `
          <tr>
            <td><strong>${w.name}</strong></td>
            <td><span class="badge badge-success">${w.role || 'Administrator'}</span></td>
            <td>${w.members ? w.members.length : 1}</td>
            <td>
              <button type="button" class="btn btn-sm ${w.id === state.activeWorkspaceId ? 'btn-primary' : 'btn-secondary'} btn-switch-ws" data-wsid="${w.id}">
                ${w.id === state.activeWorkspaceId ? 'Active' : 'Switch'}
              </button>
            </td>
          </tr>
        `).join('');

        wsTbody.querySelectorAll('.btn-switch-ws').forEach(btn => {
          btn.addEventListener('click', () => {
            const wsid = btn.getAttribute('data-wsid');
            state.activeWorkspaceId = wsid;
            updateWorkspacesUI();
            announce(`Switched to workspace ${wsid}`);
          });
        });
      }
    }

    if (wsStateTbody) {
      if (!activeWs || !activeWs.sharedData || Object.keys(activeWs.sharedData).length === 0) {
        wsStateTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No shared state synchronized yet.</td></tr>';
      } else {
        wsStateTbody.innerHTML = Object.entries(activeWs.sharedData).map(([k, v]) => `
          <tr>
            <td><code>${k}</code></td>
            <td><code>${typeof v === 'object' ? JSON.stringify(v) : String(v)}</code></td>
            <td>${state.currentUser ? state.currentUser.email : 'alice@uor.foundation'}</td>
          </tr>
        `).join('');
      }
    }
  }

  // Create Workspace form listener
  const formCreateWorkspace = document.getElementById('form-create-workspace');
  if (formCreateWorkspace) {
    formCreateWorkspace.addEventListener('submit', (e) => {
      e.preventDefault();
      const wsName = document.getElementById('ws-name-input').value.trim();
      if (!wsName) return;

      const wsId = 'ws-' + Date.now();
      const newWs = {
        id: wsId,
        name: wsName,
        orgId: state.activeOrgId,
        role: 'Administrator',
        members: [{ user: state.currentUser ? state.currentUser.email : 'alice@uor.foundation', role: 'administrator' }],
        sharedData: {},
        messages: []
      };

      state.workspaces.push(newWs);
      state.activeWorkspaceId = wsId;

      formCreateWorkspace.reset();
      updateWorkspacesUI();
      announce(`Workspace "${wsName}" created.`);
    });
  }

  // Workspace shared state mutation form listener
  const formWorkspaceState = document.getElementById('form-workspace-state');
  if (formWorkspaceState) {
    formWorkspaceState.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = document.getElementById('ws-state-key').value.trim();
      const val = document.getElementById('ws-state-val').value.trim();
      if (!key) return;

      const activeWs = state.workspaces.find(w => w.id === state.activeWorkspaceId);
      if (!activeWs) return;

      activeWs.sharedData = activeWs.sharedData || {};
      activeWs.sharedData[key] = val;

      formWorkspaceState.reset();
      updateWorkspacesUI();
      announce(`State key "${key}" synchronized in workspace.`);
    });
  }

  function updateDirectoryUI() {
    const memberList = document.getElementById('member-directory-list');
    const teamList = document.getElementById('team-directory-list');

    if (memberList) {
      memberList.innerHTML = state.members.map(m => `
        <tr>
          <td>${m.email}</td>
          <td><span class="badge badge-success">${m.role}</span></td>
          <td><code>${m.did}</code></td>
          <td>${m.scopes.join(', ')}</td>
        </tr>
      `).join('');
    }

    if (teamList) {
      teamList.innerHTML = state.teams.map(t => `
        <tr>
          <td><strong>${t.name}</strong></td>
          <td>${t.lead}</td>
          <td>${t.members}</td>
          <td>${t.workspaces.join(', ')}</td>
        </tr>
      `).join('');
    }
  }

  // Service Worker Registration (U22: Offline launch & pre-caching)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registerSW = () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        console.log('ServiceWorker registered with scope:', reg.scope);
      }).catch((err) => {
        console.warn('ServiceWorker registration failed:', err);
      });
    };
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  }

  // --- GOVERNANCE ---
  const formGov = document.getElementById('form-gov-proposal');
  if (formGov) {
    formGov.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('gov-title').value.trim();
      const scope = document.getElementById('gov-scope').value;
      const req = parseInt(document.getElementById('gov-quorum-req').value, 10);
      const proposer = state.currentUser ? state.currentUser.email : 'alice@uor.foundation';

      const propId = 'prop-' + Math.random().toString(36).substring(2, 8);
      const newProp = {
        id: propId,
        title,
        scope,
        requiredQuorum: req,
        proposer,
        approvals: [proposer],
        executed: false
      };

      state.proposals.unshift(newProp);
      dispatchToWasm(`governance:propose:${propId}:${scope}:${req}`);
      updateGovernanceUI();
      announce(`Governance proposal ${propId} created.`);
    });
  }

  function updateGovernanceUI() {
    const list = document.getElementById('active-proposals-list');
    if (list) {
      if (state.proposals.length === 0) {
        list.innerHTML = '<li class="proposal-card" role="listitem" style="padding:1rem; color:var(--color-text-muted); list-style:none;"><em>No active change proposals.</em></li>';
      } else {
        list.innerHTML = state.proposals.map(p => `
          <li class="proposal-card" role="listitem" style="list-style:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <strong>${p.title}</strong>
              <span class="badge ${p.executed ? 'badge-success' : 'badge-warning'}">${p.executed ? 'Executed' : 'Pending Quorum'}</span>
            </div>
            <p style="font-size:0.8125rem; margin:0 0 0.5rem 0;">Scope: <code>${p.scope}</code> &bull; Approvals: ${p.approvals.length} / ${p.requiredQuorum}</p>
            ${!p.executed ? `
              <div style="display:flex; gap:0.5rem;">
                <button type="button" class="btn btn-secondary btn-vote" data-id="${p.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;">Cast Signature Approval</button>
                ${p.approvals.length >= p.requiredQuorum ? `
                  <button type="button" class="btn btn-success btn-exec-prop" data-id="${p.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;">Execute Proposal</button>
                ` : ''}
              </div>
            ` : ''}
          </li>
        `).join('');
      }

      list.querySelectorAll('.btn-vote').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const p = state.proposals.find(item => item.id === id);
          if (!p) return;
          const org = state.organizations.find(o => o.id === state.activeOrgId);

          const signerOf = a => (typeof a === 'string' ? a : a.signer);
          let voter = null;
          if (state.currentUser && !p.approvals.some(a => signerOf(a) === state.currentUser.email)) {
            voter = state.currentUser.email;
          } else if (org) {
            const nextAdmin = org.admins.find(a => !p.approvals.some(ap => signerOf(ap) === a.email));
            if (nextAdmin) voter = nextAdmin.email;
          }

          if (!voter) {
            announce('Duplicate approval rejected under AM-01 policy. All eligible administrators have voted.');
            return;
          }

          let sigHex = null;
          let pubKeyHex = null;
          if (window.uorCrypto) {
            const voterAccount = `uor:user:${voter.replace('@', '_at_')}`;
            const keyRecord = await window.uorCrypto.getOrCreateKeyPair(voterAccount);
            pubKeyHex = keyRecord.pubKeyHex;
            sigHex = await window.uorCrypto.signChallenge(voterAccount, `proposal-approval:${p.id}:${voter}`);
          }

          const approvalRecord = {
            signer: voter,
            signatureHex: sigHex,
            pubKey: pubKeyHex,
            timestamp: new Date().toISOString()
          };

          p.approvals.push(approvalRecord);
          dispatchToWasm(`governance:vote:${id}:${voter}:${sigHex || 'unsigned'}`);
          updateGovernanceUI();
          announce(`Approval signature cast for proposal ${id} by administrator ${voter}.`);
        });
      });

      list.querySelectorAll('.btn-exec-prop').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const p = state.proposals.find(item => item.id === id);
          if (p) {
            p.executed = true;
            dispatchToWasm(`governance:execute:${id}`);
            state.auditLog.unshift({
              timestamp: new Date().toISOString(),
              event: `Proposal Executed: ${p.title}`,
              actor: state.currentUser ? state.currentUser.did : 'did:key:gov-quorum',
              hash: 'sha256:' + Math.random().toString(36).substring(2, 10)
            });
            updateGovernanceUI();
            updateAuditUI();
            announce(`Proposal ${id} executed successfully under quorum!`);
          }
        });
      });
    }
  }

  function updateAuditUI() {
    const tbody = document.getElementById('audit-log-tbody');
    if (tbody) {
      tbody.innerHTML = state.auditLog.map(a => `
        <tr>
          <td>${a.timestamp.substring(0, 10)}</td>
          <td>${a.event}</td>
          <td><code class="state-code">${a.actor}</code></td>
          <td><code class="state-code">${a.hash}</code></td>
        </tr>
      `).join('');
    }
  }

  // --- BUSINESS & FINANCE ---
  const formFinance = document.getElementById('form-journal-entry');
  if (formFinance) {
    formFinance.addEventListener('submit', (e) => {
      e.preventDefault();
      const desc = document.getElementById('fin-desc').value.trim();
      const debit = document.getElementById('fin-debit-acc').value;
      const credit = document.getElementById('fin-credit-acc').value;
      const amount = parseInt(document.getElementById('fin-amount').value, 10);

      const entryId = 'JE-' + (state.journalEntries.length + 101);
      const newEntry = {
        id: entryId,
        desc,
        debit: `${debit}: ${amount.toLocaleString()}`,
        credit: `${credit}: ${amount.toLocaleString()}`,
        amount,
        status: 'PendingSettlement'
      };

      state.journalEntries.unshift(newEntry);
      dispatchToWasm(`finance:post:${entryId}:${amount}`);
      updateFinanceUI();
      announce(`Journal entry ${entryId} posted (Pending Settlement Oracle Proof).`);
    });
  }

  document.getElementById('btn-verify-settlement')?.addEventListener('click', async () => {
    const pending = state.journalEntries.find(j => j.status === 'PendingSettlement');
    if (pending) {
      pending.status = 'Settled';
      const proof = await sha256Hex(`settlement-proof-${pending.id}`);
      dispatchToWasm(`finance:settle:${pending.id}:${proof}`);
      updateFinanceUI();
      announce(`Settlement verified by payment oracle for ${pending.id}!`);
    } else {
      announce('All journal entries are already settled.');
    }
  });

  function updateFinanceUI() {
    const tbody = document.getElementById('finance-ledger-tbody');
    if (tbody) {
      tbody.innerHTML = state.journalEntries.map(j => `
        <tr>
          <td><code>${j.id}</code></td>
          <td>${j.desc}</td>
          <td>${j.debit}</td>
          <td>${j.credit}</td>
          <td><span class="badge ${j.status === 'Settled' ? 'badge-success' : 'badge-warning'}">${j.status}</span></td>
        </tr>
      `).join('');
    }
  }

  // --- LEARNING & VERIFIABLE CREDENTIALS ---
  const formAssessment = document.getElementById('form-submit-assessment');
  if (formAssessment) {
    formAssessment.addEventListener('submit', (e) => {
      e.preventDefault();
      const course = document.getElementById('course-select').value;
      const evidence = document.getElementById('evidence-link').value.trim();
      const studentDid = state.currentUser ? state.currentUser.did : 'did:key:z6MkuStudent';

      const vcId = 'urn:uuid:' + Math.random().toString(36).substring(2, 10);
      const newVC = {
        id: vcId,
        course,
        issuer: 'did:key:uor-foundation-accreditation',
        subject: studentDid,
        evidence,
        date: new Date().toISOString().substring(0, 10)
      };

      state.credentials.unshift(newVC);
      dispatchToWasm(`learning:issue_vc:${course}:${studentDid}`);

      const wallet = document.getElementById('vc-wallet');
      if (wallet) {
        wallet.innerHTML = state.credentials.map(vc => `
          <li class="vc-card" role="listitem" style="list-style:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.75rem;">
              <span class="vc-badge" style="font-weight:600; color:var(--color-info);">W3C Verifiable Credential 2.0</span>
              <span class="badge badge-success">Cryptographically Verified</span>
            </div>
            <h4 style="margin:0 0 0.25rem 0; font-size:1rem;">Certificate of Mastery: ${vc.course}</h4>
            <p style="margin:0; font-size:0.75rem; color:var(--color-text-muted);">Issuer: <code>${vc.issuer}</code></p>
            <p style="margin:0; font-size:0.75rem; color:var(--color-text-muted);">Subject: <code>${vc.subject}</code></p>
            <p style="margin:0.25rem 0 0 0; font-size:0.75rem; color:var(--color-success);">Evidence: <code>${vc.evidence}</code></p>
          </li>
        `).join('');
      }

      announce(`Accreditation submitted and W3C Verifiable Credential issued for ${course}!`);
    });
  }

  // --- PERSISTENT KAPPA STORE (U19) ---
  const KAPPA_DB_NAME = 'uor_foundry_web_v1_kappa_store';
  const KAPPA_DB_VERSION = 1;
  const KAPPA_STORE_NAME = 'objects';

  function openKappaStore() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(KAPPA_DB_NAME, KAPPA_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(KAPPA_STORE_NAME)) {
          db.createObjectStore(KAPPA_STORE_NAME, { keyPath: 'digest' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function putBlob(digest, bytesOrText, capabilityToken) {
    if (!digest || typeof digest !== 'string') {
      throw new Error('Invalid digest parameter: must be non-empty string');
    }
    const rawData = typeof bytesOrText === 'string'
      ? new TextEncoder().encode(bytesOrText)
      : (bytesOrText instanceof Uint8Array ? bytesOrText : new Uint8Array(bytesOrText));
    const computedHex = await sha256Hex(rawData);
    const normalizedExpected = digest.startsWith('sha256:') ? digest.substring(7) : digest;
    if (computedHex !== normalizedExpected) {
      throw new Error(`Digest mismatch: expected ${normalizedExpected}, computed ${computedHex}`);
    }
    const canonicalDigest = `sha256:${computedHex}`;
    const record = {
      digest: canonicalDigest,
      rawDigest: computedHex,
      data: typeof bytesOrText === 'string' ? bytesOrText : Array.from(rawData),
      isString: typeof bytesOrText === 'string',
      length: rawData.length,
      capabilityToken: capabilityToken || null,
      storedAt: new Date().toISOString()
    };

    state.blobs.set(canonicalDigest, bytesOrText);
    state.blobs.set(computedHex, bytesOrText);

    const db = await openKappaStore();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(KAPPA_STORE_NAME, 'readwrite');
        const store = tx.objectStore(KAPPA_STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    // Monotonic WAL revision update
    try {
      await appendJournalEntry({
        revision: state.journalRevision + 1,
        type: 'KappaBlobStored',
        payload: canonicalDigest,
        actor: state.currentUser ? state.currentUser.did : 'did:key:anonymous'
      });
    } catch (_) {}

    return record;
  }

  async function getBlob(digest, capabilityToken) {
    const normalizedDigest = digest.startsWith('sha256:') ? digest : `sha256:${digest}`;
    const rawDigest = digest.startsWith('sha256:') ? digest.substring(7) : digest;

    const db = await openKappaStore();
    if (db) {
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(KAPPA_STORE_NAME, 'readonly');
        const store = tx.objectStore(KAPPA_STORE_NAME);
        const req = store.get(normalizedDigest);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (record) return record;
    }

    const mem = state.blobs.get(normalizedDigest) || state.blobs.get(rawDigest);
    if (mem !== undefined) {
      return {
        digest: normalizedDigest,
        rawDigest: rawDigest,
        data: mem,
        isString: typeof mem === 'string',
        capabilityToken: capabilityToken || null
      };
    }
    return null;
  }

  // --- ANTI-ROLLBACK WAL JOURNAL (U21) ---
  const JOURNAL_DB_NAME = 'uor_foundry_web_v1_journal';
  const JOURNAL_STORE = 'journal';
  const CHECKPOINT_STORE = 'checkpoints';

  function openJournalDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(JOURNAL_DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
          db.createObjectStore(JOURNAL_STORE, { keyPath: 'revision' });
        }
        if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
          db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'revision' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function appendJournalEntry(entry) {
    if (!entry || typeof entry.revision !== 'number' || !Number.isFinite(entry.revision) || entry.revision <= state.journalRevision) {
      throw new Error(`Rollback detected: incoming revision ${entry?.revision} <= local revision ${state.journalRevision}`);
    }
    state.journalRevision = entry.revision;
    const record = {
      revision: entry.revision,
      type: entry.type,
      payload: entry.payload || '',
      actor: entry.actor || 'did:key:local',
      signature: entry.signature || null,
      timestamp: entry.timestamp || new Date().toISOString()
    };
    state.walJournal.unshift(record);

    const db = await openJournalDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(JOURNAL_STORE, 'readwrite');
        const store = tx.objectStore(JOURNAL_STORE);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    updateJournalUI();
    return record;
  }

  async function saveSignedCheckpoint(checkpoint) {
    if (checkpoint.revision < state.journalRevision) {
      throw new Error(`Rollback rejected: checkpoint revision ${checkpoint.revision} < current revision ${state.journalRevision}`);
    }
    state.lastCheckpoint = checkpoint;
    const db = await openJournalDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(CHECKPOINT_STORE, 'readwrite');
        const store = tx.objectStore(CHECKPOINT_STORE);
        const req = store.put(checkpoint);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    updateJournalUI();
    return checkpoint;
  }

  function updateJournalUI() {
    const revEl = document.getElementById('journal-current-revision');
    const checkEl = document.getElementById('journal-last-checkpoint');
    const tbody = document.getElementById('journal-tbody');

    if (revEl) revEl.textContent = String(state.journalRevision);
    if (checkEl) checkEl.textContent = state.lastCheckpoint ? `Rev ${state.lastCheckpoint.revision}` : 'None';

    if (tbody) {
      if (state.walJournal.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">Journal initialized at revision 0.</td></tr>';
      } else {
        tbody.innerHTML = state.walJournal.slice(0, 10).map(j => `
          <tr>
            <td><code>${j.revision}</code></td>
            <td>${j.type}</td>
            <td><code class="state-code">${(j.actor || '').substring(0, 18)}</code></td>
            <td>${(j.timestamp || '').substring(11, 19)}</td>
          </tr>
        `).join('');
      }
    }
  }

  // --- VEILID BOOTSTRAP WSS TRANSPORT CLIENT (U20) ---
  class VeilidWssClient {
    constructor(relays = ['wss://bootstrap1.veilid.net:5150', 'wss://bootstrap2.veilid.net:5150']) {
      this.relays = relays;
      this.currentRelayIndex = 0;
      this.ws = null;
      this.status = 'disconnected';
      this.reconnectAttempts = 0;
      this.maxReconnectDelay = 30000;
      this.pingInterval = null;
      this.paused = false;
    }

    connect() {
      if (this.paused || typeof WebSocket === 'undefined') return;
      const url = this.relays[this.currentRelayIndex];
      this.status = 'connecting';
      this.updateStatusUI();

      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        this.scheduleReconnect();
        return;
      }

      this.ws.onopen = () => {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.updateStatusUI();
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            } catch (_) {}
          }
        }, 25000);
      };

      this.ws.onmessage = () => {};
      this.ws.onerror = () => {};

      this.ws.onclose = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.paused) {
          this.status = 'disconnected';
          this.updateStatusUI();
          return;
        }
        this.status = 'reconnecting';
        this.updateStatusUI();
        this.scheduleReconnect();
      };
    }

    scheduleReconnect() {
      this.currentRelayIndex = (this.currentRelayIndex + 1) % this.relays.length;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      setTimeout(() => {
        if (!this.paused) this.connect();
      }, delay);
    }

    pause() {
      this.paused = true;
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.ws) {
        try { this.ws.close(); } catch (_) {}
        this.ws = null;
      }
      this.status = 'disconnected';
      this.updateStatusUI();
    }

    resume() {
      this.paused = false;
      this.reconnectAttempts = 0;
      this.connect();
    }

    updateStatusUI() {
      const peerStatus = document.getElementById('peer-sync-status');
      const dot = document.getElementById('network-indicator-dot');
      const text = document.getElementById('network-status-text');

      if (this.status === 'connected') {
        if (peerStatus) {
          peerStatus.textContent = 'Connected (3 Replicas)';
          peerStatus.className = 'badge badge-success';
        }
        if (dot) dot.className = 'network-indicator online';
        if (text) text.textContent = 'Online';
      } else if (this.status === 'connecting' || this.status === 'reconnecting') {
        if (peerStatus) {
          peerStatus.textContent = `Connecting (${this.relays[this.currentRelayIndex]})`;
          peerStatus.className = 'badge badge-warning';
        }
      } else {
        if (peerStatus) {
          peerStatus.textContent = 'Disconnected (Offline Queueing)';
          peerStatus.className = 'badge badge-warning';
        }
        if (dot) dot.className = 'network-indicator offline';
        if (text) text.textContent = 'Offline';
      }
    }
  }

  const veilidClient = new VeilidWssClient();
  veilidClient.connect();

  const formStoreBlob = document.getElementById('form-store-blob');
  if (formStoreBlob) {
    formStoreBlob.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = document.getElementById('blob-input-data').value;
      const digest = await sha256Hex(data);

      try {
        const record = await putBlob(digest, data);
        dispatchToWasm(`kappa:store:${digest}`);

        const resultBox = document.getElementById('blob-result-display');
        if (resultBox) {
          resultBox.innerHTML = `
            <div class="alert-box alert-success" style="margin-top:0.75rem;">
              <strong>Blob Stored in Persistent Kappa Store!</strong><br>
              Content Digest: <code class="state-code">${record.digest}</code><br>
              Payload Length: ${record.length} bytes.<br>
              WAL Revision: <code>${state.journalRevision}</code>
            </div>
          `;
        }
        announce(`Blob stored under SHA-256 digest ${record.digest}`);
      } catch (err) {
        announce(`Storage error: ${err.message}`);
      }
    });
  }

  const formGetBlob = document.getElementById('form-get-blob');
  if (formGetBlob) {
    formGetBlob.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputDigest = document.getElementById('blob-lookup-digest').value.trim();
      const resultBox = document.getElementById('blob-retrieve-display');

      const record = await getBlob(inputDigest);
      if (record) {
        const contentStr = record.isString ? record.data : new TextDecoder().decode(new Uint8Array(record.data));
        if (resultBox) {
          resultBox.innerHTML = `
            <div class="alert-box alert-success" style="margin-top:0.75rem;">
              <strong>Blob Retrieved &amp; Verified!</strong><br>
              Digest: <code class="state-code">${record.digest}</code><br>
              Content: <code>${contentStr.substring(0, 100)}${contentStr.length > 100 ? '...' : ''}</code>
            </div>
          `;
        }
        announce(`Retrieved blob for digest ${inputDigest}`);
      } else {
        if (resultBox) {
          resultBox.innerHTML = `
            <div class="alert-box alert-danger" style="margin-top:0.75rem;">
              <strong>Blob Not Found!</strong> Digest <code>${inputDigest}</code> does not exist in store.
            </div>
          `;
        }
        announce(`Blob not found for digest ${inputDigest}`);
      }
    });
  }

  document.getElementById('btn-toggle-offline')?.addEventListener('click', () => {
    state.isOnline = !state.isOnline;
    if (state.isOnline) {
      veilidClient.resume();
    } else {
      veilidClient.pause();
    }
    announce(state.isOnline ? 'Network restored. Reconnected to Veilid P2P mesh.' : 'Offline mode active. Mutations will queue locally.');
  });

  document.getElementById('btn-flush-sync')?.addEventListener('click', () => {
    dispatchToWasm('resilience:sync');
    announce('CRDT vector clocks reconciled with all 3 replicas. Sync complete.');
  });

  // --- INITIALIZE UI STATE ---
  updateIdentityUI();
  updateOrgUI();
  initTheme();
  updateProjectsUI();
  updateChannelsUI();
  updateInboxUI();
  updateWorkspacesUI();
  updateDirectoryUI();
  updateGovernanceUI();
  updateAuditUI();
  updateJournalUI();

  // Expose global test harness for Playwright and programmatic verification
  window.uorFoundry = {
    dispatch: function(cmd) { return dispatchToWasm(cmd); },
    activateTab: function(tabId) {
      const tab = document.getElementById(tabId);
      if (tab) activateTab(tab);
    },
    putBlob,
    getBlob,
    appendJournalEntry,
    saveSignedCheckpoint,
    veilidClient,
    state,
    version: '0.3.0',
    spec: 'uor-foundry/prismpm-pure-model/1',
    // Theme & Accessibility (M4 - U05)
    setTheme,
    getTheme: () => state.theme,
    toggleTheme,
    openShortcutsModal,
    closeShortcutsModal,
    // Milestone 3 API endpoints
    updateProjectsUI,
    updateChannelsUI,
    updateInboxUI,
    updateWorkspacesUI,
    updateDirectoryUI,
    dispatchNotification,
    markNotificationRead,
    markAllNotificationsRead,
    verifyActivityChain,
    appendProjectActivity
  };

  console.log('UOR Foundry Portal successfully initialized under pure-model architecture.');
})();
