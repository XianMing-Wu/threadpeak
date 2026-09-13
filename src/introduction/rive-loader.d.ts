export function loadRiveBytes(url: string | URL, signal?: AbortSignal, kind?: 'riv' | 'wasm'): Promise<Uint8Array>;
export function loadRiveRuntime(url?: string): Promise<unknown>;
