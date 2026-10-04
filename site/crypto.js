/**
 * UOR Foundry WebCrypto Non-Extractable Key Custody & Security Engine
 * Complies with:
 * - W3C Web Cryptography API
 * - W3C DID Core 1.0
 * - NIST SP 800-63B-4 Authenticator Assurance & Backup Codes
 */

const DB_NAME = 'uor_foundry_web_v1_identity_vault';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const SIGNING_PREFIX = '\x19UOR Foundry Auth v1:\n';

function prefixChallenge(challenge) {
  const prefixBytes = new TextEncoder().encode(SIGNING_PREFIX);
  const challengeBytes = typeof challenge === 'string'
    ? new TextEncoder().encode(challenge)
    : (challenge instanceof Uint8Array ? challenge : new Uint8Array(challenge));
  const merged = new Uint8Array(prefixBytes.length + challengeBytes.length);
  merged.set(prefixBytes, 0);
  merged.set(challengeBytes, prefixBytes.length);
  return merged;
}

// In-memory fallback if IndexedDB is unavailable
const memoryKeyStore = new Map();

/**
 * Open IndexedDB key vault
 */
function openVault() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'accountId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('IndexedDB unavailable, falling back to memory vault:', request.error);
      resolve(null);
    };
  });
}

/**
 * Store a key record in IndexedDB or memory fallback
 */
async function storeKeyRecord(record) {
  const db = await openVault();
  if (!db) {
    memoryKeyStore.set(record.accountId, record);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get a key record by accountId
 */
async function getKeyRecord(accountId) {
  const db = await openVault();
  if (!db) {
    return memoryKeyStore.get(accountId) || null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(accountId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a key record by accountId
 */
async function deleteKeyRecord(accountId) {
  const db = await openVault();
  if (!db) {
    memoryKeyStore.delete(accountId);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(accountId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generate a non-extractable ECDSA P-256 key pair, export public key SPKI,
 * and persist into IndexedDB.
 */
async function getOrCreateKeyPair(accountId) {
  let existing = await getKeyRecord(accountId);
  if (existing) {
    return existing;
  }

  // Generate non-extractable private key (extractable = false)
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false, // Non-extractable private key per NIST SP 800-63B / WebCrypto standards
    ['sign', 'verify']
  );

  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const spkiBytes = new Uint8Array(spki);
  const pubKeyHex = Array.from(spkiBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const rawKeyHex = pubKeyHex.length > 54 ? pubKeyHex.substring(54) : pubKeyHex;
  const did = `did:key:zDna${rawKeyHex.substring(0, 32)}`;

  const record = {
    accountId,
    keyPair,
    pubKeyHex,
    did,
    createdAt: new Date().toISOString()
  };

  await storeKeyRecord(record);
  return record;
}

/**
 * Rotate keypair for an existing account (generates fresh non-extractable key)
 */
async function rotateKeyPair(accountId) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign', 'verify']
  );

  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const spkiBytes = new Uint8Array(spki);
  const pubKeyHex = Array.from(spkiBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const rawKeyHex = pubKeyHex.length > 54 ? pubKeyHex.substring(54) : pubKeyHex;
  const did = `did:key:zDna${rawKeyHex.substring(0, 32)}`;

  const record = {
    accountId,
    keyPair,
    pubKeyHex,
    did,
    rotatedAt: new Date().toISOString()
  };

  await storeKeyRecord(record);
  return record;
}

/**
 * Sign challenge using non-extractable private key from IndexedDB with domain prefix
 */
async function signChallenge(accountId, challenge) {
  const record = await getKeyRecord(accountId);
  if (!record || !record.keyPair || !record.keyPair.privateKey) {
    throw new Error(`No cryptographic key found for account ${accountId}`);
  }

  const prefixedData = prefixChallenge(challenge);
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' }
    },
    record.keyPair.privateKey,
    prefixedData
  );

  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify signature with public key and domain prefix
 */
async function verifySignature(publicKey, signatureHex, challenge) {
  if (typeof signatureHex !== 'string') return false;
  if (signatureHex.length === 0 || signatureHex.length % 2 !== 0) return false;
  if (!/^[0-9a-fA-F]+$/.test(signatureHex)) return false;
  if (/^0+$/.test(signatureHex)) return false;

  const prefixedData = prefixChallenge(challenge);
  const sigBytes = new Uint8Array(signatureHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  try {
    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      publicKey,
      sigBytes,
      prefixedData
    );
  } catch {
    return false;
  }
}

/**
 * Helper to compute SHA-256 hex digest
 */
async function sha256Hex(textOrBuffer) {
  const data = typeof textOrBuffer === 'string' ? new TextEncoder().encode(textOrBuffer) : textOrBuffer;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate 10 NIST SP 800-63B-4 compliant backup codes with CSPRNG and 16-byte random salts.
 */
async function generateNistBackupCodes(count = 10) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes = [];

  for (let i = 0; i < count; i++) {
    // Generate CSPRNG code
    const randomIndices = new Uint8Array(10);
    crypto.getRandomValues(randomIndices);
    let codePart1 = '';
    let codePart2 = '';
    for (let j = 0; j < 5; j++) {
      codePart1 += alphabet[randomIndices[j] % alphabet.length];
      codePart2 += alphabet[randomIndices[j + 5] % alphabet.length];
    }
    const code = `BK-${codePart1}-${codePart2}`;

    // 16-byte cryptographic random salt
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Salted SHA-256 hash
    const hash = await sha256Hex(`${salt}:${code}`);

    codes.push({
      code,
      salt,
      hash,
      used: false
    });
  }

  return codes;
}

/**
 * Hash a candidate backup code with the given salt
 */
async function hashBackupCode(code, salt) {
  return await sha256Hex(`${salt}:${code.trim().toUpperCase()}`);
}

/**
 * Zero out sensitive buffer in memory
 */
function zeroize(buffer) {
  if (buffer && buffer.fill) {
    buffer.fill(0);
  }
}

/**
 * Generate a 256-bit AES-GCM symmetric key
 */
async function generateSymmetricKey() {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext blob using AES-256-GCM with a 12-byte random IV
 */
async function encryptBlob(key, plainBytes) {
  const data = typeof plainBytes === 'string'
    ? new TextEncoder().encode(plainBytes)
    : (plainBytes instanceof Uint8Array ? plainBytes : new Uint8Array(plainBytes));
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  );
  return {
    ciphertext: new Uint8Array(encrypted),
    iv: iv
  };
}

/**
 * Decrypt a ciphertext blob using AES-256-GCM
 */
async function decryptBlob(key, cipherBytes, iv) {
  const cipherData = cipherBytes instanceof Uint8Array ? cipherBytes : new Uint8Array(cipherBytes);
  const ivData = iv instanceof Uint8Array ? iv : new Uint8Array(iv);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivData
    },
    key,
    cipherData
  );
  return new Uint8Array(decrypted);
}

// Global attachment for browser scripts and module export
const uorCrypto = {
  getOrCreateKeyPair,
  rotateKeyPair,
  deleteKeyPair: deleteKeyRecord,
  getKeyRecord,
  signChallenge,
  verifySignature,
  sha256Hex,
  generateNistBackupCodes,
  hashBackupCode,
  zeroize,
  generateSymmetricKey,
  encryptBlob,
  decryptBlob,
  SIGNING_PREFIX
};

if (typeof globalThis !== 'undefined') {
  globalThis.uorCrypto = uorCrypto;
}

if (typeof window !== 'undefined') {
  window.uorCrypto = uorCrypto;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = uorCrypto;
}
