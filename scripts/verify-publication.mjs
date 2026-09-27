// Actual SDK byte observation only. This cannot accept an application release.
import { mkdirSync, writeFileSync } from 'node:fs';
import { sdk, selectedProducer, verifyProducer, bindBrowserReceipt } from './publication-sdk.mjs';

try {
  if (process.argv.length !== 2) throw new Error('Target and release must come from the reviewed selection');
  const { release, target } = selectedProducer();
  verifyProducer(release);
  // The SDK independently captures and re-verifies the immutable OCI closure;
  // neither a caller receipt nor an exported local tree is a verification input.
  const receipt = sdk('verify-browser-publication', release.reference, '--url', target);
  bindBrowserReceipt(receipt, release, { target });
  mkdirSync('reports/publication', { recursive: true });
  writeFileSync('reports/publication/integrity.json', `${JSON.stringify(receipt)}\n`);
  console.log(JSON.stringify(receipt));
} catch (error) {
  console.error(`publication integrity validation error: ${error.message}`);
  process.exitCode = 1;
}
