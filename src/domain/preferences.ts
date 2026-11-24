export function preference(key: string) {
  try { return localStorage.getItem('enad:'+key) || '' } catch { return '' }
}
export function remember(key: string, value: string) {
  try { localStorage.setItem('enad:'+key,value) } catch { /* Private storage is optional. */ }
}
