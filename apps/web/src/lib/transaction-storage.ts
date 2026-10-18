/** Tab-local public transaction recovery. No keys or unpublished text is stored. */
export function readTransaction<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null", (_key, value) =>
      typeof value === "string" && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value) as T | null
  } catch { return null }
}
export function saveTransaction(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value, (_key, item) => typeof item === "bigint" ? `${item}n` : item))
  } catch { /* Explorer links remain available when tab storage is disabled. */ }
}
