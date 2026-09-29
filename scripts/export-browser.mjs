// Publication infrastructure only. Never generates or patches application bytes.
import { lstatSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { regular, sdk, selectedProducer, verifyProducer, bindBrowserReceipt } from './publication-sdk.mjs';

const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function walk(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walk(root, path);
    if (!entry.isFile()) throw new Error(`Export contains a non-regular file: ${path}`);
    return [path];
  }).sort();
}
try {
  const output = process.argv[2];
  if (process.argv.length !== 3 || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(output ?? '')) {
    throw new Error('Output must be one new portable directory name');
  }
  const { release } = selectedProducer();
  try { lstatSync(output); throw new Error('Export destination already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }

  verifyProducer(release);
  const receipt = sdk('export-browser', release.reference, '--output', output);
  bindBrowserReceipt(receipt, release, { output });
  if (!lstatSync(output).isDirectory()) throw new Error('Export root is not an ordinary directory');
  const actual = walk(output);
  if (new Set(receipt.files.map(file => file.path)).size !== receipt.files.length
    || JSON.stringify(actual) !== JSON.stringify(receipt.files.map(file => file.path).sort())) {
    throw new Error('Exported file inventory is incomplete or contains extra files');
  }
  for (const file of receipt.files) {
    if (!/^[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9_-]+)*$/.test(file.path)
      || file.path.startsWith('/') || file.path.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Unsafe artifact path');
    }
    const bytes = regular(join(output, file.path));
    if (bytes.length !== file.size || sha(bytes) !== file.digest) throw new Error(`Export bytes changed: ${file.path}`);
  }
  // Stored outside the published directory; never add files to the SDK closure.
  mkdirSync('reports/publication', { recursive: true });
  writeFileSync('reports/publication/export.json', `${JSON.stringify(receipt)}\n`);
  console.log(JSON.stringify(receipt));
} catch (error) {
  console.error(`publication pipeline validation error: ${error.message}`);
  process.exitCode = 1;
}
