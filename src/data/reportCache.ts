const prefix = 'enad:report:v2.2:'
export const reportTtl = 600_000
export const reportCache = new class extends Map<string, { expires: number; value: Promise<unknown> }> {
  override clear() {
    super.clear()
    try {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key)
    } catch { /* Storage may be unavailable in private browsing. */ }
  }
}()
export function cachedResult<T>(key: string, read: (signal: AbortSignal) => Promise<T>, persist = true): Promise<T> {
  const now = Date.now()
  for (const [k, entry] of reportCache) if (entry.expires <= now) reportCache.delete(k)
  const hit = reportCache.get(key)
  if (hit) return hit.value as Promise<T>
  try {
    const item = JSON.parse(sessionStorage.getItem(prefix + key) ?? 'null')
    if (item && item.expires > now) {
      const value = Promise.resolve<T>(item.result)
      reportCache.set(key, { expires: item.expires, value })
      return value
    }
    sessionStorage.removeItem(prefix + key)
  } catch { /* Fall back to memory. */ }
  const expires = now + reportTtl
  const controller = new AbortController()
  const value = withReadTimeout(read(controller.signal), () => controller.abort()).then(result => {
    if (persist && reportCache.get(key)?.value === value) {
      try { sessionStorage.setItem(prefix + key, JSON.stringify({ expires, result })) } catch { /* Memory cache still holds large results. */ }
    }
    return result
  }).catch((error: unknown) => {
    if (reportCache.get(key)?.value === value) reportCache.delete(key)
    throw error
  })
  reportCache.set(key, { expires, value })
  return value
}

export async function withReadTimeout<T>(read: Promise<T>, onTimeout?: () => void, delay = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { onTimeout?.(); reject(new Error('La consulta tardó demasiado. Intenta de nuevo en unos minutos.')) }, delay)
    })
    return await Promise.race([read, timeout])
  } finally { clearTimeout(timer) }
}

export function reportWidgets() {
  const unavailable = new Set<string>()
  const deadline = Date.now() + 15_000
  async function widget<T>(label:string,read:Promise<T>,fallback:T) {
    try { return await withReadTimeout(read,undefined,Math.max(0,deadline-Date.now())) }
    catch { unavailable.add(label); return fallback }
  }
  return {unavailable,widget}
}
