const STORAGE_KEY = 'mailsure.saved-check.v1'

export function readSavedCheck(storage) {
  try {
    storage ??= globalThis.localStorage
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return { addressText: '', results: null }

    const saved = JSON.parse(raw)
    if (saved?.version !== 1 || typeof saved.addressText !== 'string') {
      return { addressText: '', results: null }
    }

    const results = Array.isArray(saved.results)
      && saved.results.every((row) => row && typeof row.email === 'string' && typeof row.classification === 'string')
      ? saved.results
      : null

    return { addressText: saved.addressText, results }
  } catch {
    // Storage can be disabled or contain malformed JSON. Start with a clean app state.
    return { addressText: '', results: null }
  }
}

export function writeSavedCheck(addressText, results, storage) {
  try {
    storage ??= globalThis.localStorage
    storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, addressText, results }))
    return true
  } catch {
    // Storage may be unavailable or full; checking should still work normally.
    return false
  }
}
