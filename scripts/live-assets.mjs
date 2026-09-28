// LA-01 diagnostic transport only; no release or application acceptance.
import { createHash } from 'node:crypto';

export const maximumLiveAssetBytes = 67_108_864;
const segmentBytes = 1_048_576;
const failure = (code, message) => Object.assign(new Error(`LA-01 asset capture: ${message}`), { code });

export async function captureLiveAsset(url, { expectedSize = null, timeoutMilliseconds = 30_000 } = {}) {
  if ((expectedSize !== null && (!Number.isSafeInteger(expectedSize)
    || expectedSize < 0 || expectedSize > maximumLiveAssetBytes))
    || !Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || timeoutMilliseconds > 30_000) {
    throw failure('ASSET_POLICY', 'invalid observation bounds');
  }
  const target = new URL(url).href;
  const maximum = expectedSize ?? maximumLiveAssetBytes;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(failure('ASSET_TIMEOUT', 'observation deadline exceeded')),
    timeoutMilliseconds);
  timer.unref();
  let reader;
  try {
    const response = await fetch(target, { redirect: 'error', signal: controller.signal });
    reader = response.body?.getReader();
    const segments = [], hash = createHash('sha256');
    let size = 0, used = 0, segment;
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > maximum - size) throw failure('ASSET_BOUND', 'response exceeds its byte bound');
      // Coalesce tiny network chunks: at most 64 segment records, not one
      // allocation per attacker-selected chunk. The final copy is also bounded.
      let offset = 0;
      while (offset < value.byteLength) {
        if (!segment || used === segment.length) {
          segment = Buffer.allocUnsafe(Math.min(segmentBytes, maximum - size));
          segments.push(segment); used = 0;
        }
        const length = Math.min(value.byteLength - offset, segment.length - used);
        segment.set(value.subarray(offset, offset + length), used);
        used += length; offset += length; size += length;
      }
      hash.update(value);
    }
    if (expectedSize !== null && size !== expectedSize) throw failure('ASSET_LENGTH', 'response ended at the wrong size');
    if (segment) segments[segments.length - 1] = segment.subarray(0, used);
    const bytes = Buffer.concat(segments, size);
    return Object.freeze({ bytes, size, digest: `sha256:${hash.digest('hex')}`,
      status: response.status, contentType: response.headers.get('content-type') });
  } finally {
    clearTimeout(timer);
    // Abort even on a framing/budget exception; a hostile producer must not
    // retain a live body/socket after the observation has ended.
    controller.abort();
    if (reader) {
      try { await reader.cancel(); } catch { /* The original refusal remains authoritative. */ }
      reader.releaseLock();
    }
  }
}
