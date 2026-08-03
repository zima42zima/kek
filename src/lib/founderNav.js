const OPEN_FOUNDER_KEY = 'frens-open-founder-console'

export function requestOpenFounderConsole() {
  try {
    sessionStorage.setItem(OPEN_FOUNDER_KEY, '1')
  } catch { /* ignore */ }
}

export function peekOpenFounderConsoleFlag() {
  try {
    return sessionStorage.getItem(OPEN_FOUNDER_KEY) === '1'
  } catch {
    return false
  }
}

export function consumeOpenFounderConsoleFlag() {
  try {
    if (sessionStorage.getItem(OPEN_FOUNDER_KEY) === '1') {
      sessionStorage.removeItem(OPEN_FOUNDER_KEY)
      return true
    }
  } catch { /* ignore */ }
  return false
}
