/** Preserve document identity, including query parameters and hash-router paths. */
export function evidenceUrlKey(value:string):string {
  const url=new URL(value)
  for(const key of [...url.searchParams.keys()]){
    if(/^utm_/i.test(key)||['gclid','dclid','fbclid','msclkid'].includes(key.toLowerCase()))url.searchParams.delete(key)
  }
  return url.href
}
