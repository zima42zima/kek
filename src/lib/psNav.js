const OPEN_PS_KEY = 'frens-open-ps'

export function requestOpenPsPanel(section = 'letters') {
  try {
    sessionStorage.setItem(OPEN_PS_KEY, section)
  } catch { /* ignore */ }
}

export function consumeOpenPsFlag() {
  try {
    const v = sessionStorage.getItem(OPEN_PS_KEY)
    if (v) {
      sessionStorage.removeItem(OPEN_PS_KEY)
      return v === 'folds' ? 'folds' : 'letters'
    }
    if (sessionStorage.getItem('frens-open-owl') === '1') {
      sessionStorage.removeItem('frens-open-owl')
      return 'letters'
    }
  } catch { /* ignore */ }
  return null
}
