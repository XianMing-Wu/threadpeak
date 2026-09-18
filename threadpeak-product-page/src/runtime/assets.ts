/** Only this module decides how a local asset is read in file:// versus HTTP. */
declare global {
  interface Window {
    __PRODUCT_ASSETS__?: Record<string, string>;
    __PRODUCT_TEXT_ASSETS__?: Record<string, string>;
    __PRODUCT_DATA__?: Record<string, unknown>;
  }
}

const knownUrls = new Set<string>();

export function assetUrl(file: string): string {
  if (!file.startsWith('assets/') || file.split('/').includes('..')) {
    throw new Error(`Invalid local asset path: ${file}`);
  }
  const url = location.protocol === 'file:'
    ? window.__PRODUCT_ASSETS__?.[file]
    : new URL(file, document.baseURI).href;
  if (!url) throw new Error(`Local asset is missing: ${file}`);
  knownUrls.add(url);
  return url;
}

export function isBundledAssetUrl(value?: string): boolean {
  return Boolean(value && knownUrls.has(value));
}

/** SVG text is needed synchronously when constructing the 3D lettering geometry. */
export function assetText(file: string): string {
  const cached = window.__PRODUCT_TEXT_ASSETS__?.[file];
  if (cached !== undefined) return cached;
  const encoded = window.__PRODUCT_ASSETS__?.[file];
  if (!encoded) throw new Error(`Local text asset is missing: ${file}`);
  const comma = encoded.indexOf(',');
  const bytes = Uint8Array.from(atob(encoded.slice(comma + 1)), char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Demo JSON stores readable local paths. Resolve those paths at the boundary only. */
export function resolveAssetReferences<T>(value: T): T {
  if (typeof value === 'string' && value.startsWith('assets/')) return assetUrl(value) as T;
  if (Array.isArray(value)) return value.map(resolveAssetReferences) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAssetReferences(item)])) as T;
  }
  return value;
}
