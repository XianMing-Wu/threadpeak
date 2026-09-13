import createRiveRuntime from '../vendor/introduction-rive/canvas_advanced.mjs';
import bundledWasmUrl from '../vendor/introduction-rive/rive.wasm?url';

const runtimes = new Map();

/** Reject HTML error pages and bound network waits before passing bytes to WASM. */
export async function loadRiveBytes(url, signal, kind = 'riv') {
  const deadline = new AbortController();
  const abort = () => deadline.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => deadline.abort(new DOMException('Character resource timed out', 'TimeoutError')), 12000);
  try {
    const response = await fetch(url, { signal: deadline.signal });
    if (!response.ok) throw new Error(`Character ${kind} resource: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const magic = kind === 'wasm' ? [0, 97, 115, 109] : [82, 73, 86, 69];
    if (!magic.every((value, i) => bytes[i] === value)) throw new Error(`Invalid character ${kind} resource`);
    return bytes;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function loadRiveRuntime(url = bundledWasmUrl) {
  const key = String(url);
  if (!runtimes.has(key)) {
    // Pass verified bytes explicitly: a wrong server MIME type must not break
    // streaming WASM compilation for every character at once.
    const pending = loadRiveBytes(url, undefined, 'wasm').then(wasmBinary => createRiveRuntime({ wasmBinary }));
    runtimes.set(key, pending);
    pending.catch(() => { if (runtimes.get(key) === pending) runtimes.delete(key); });
    // Only the bundled runtime is used in production; keep custom module URLs bounded too.
    if (runtimes.size > 4) runtimes.delete(runtimes.keys().next().value);
  }
  return runtimes.get(key);
}
