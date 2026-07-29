// Insert `insert` into a textarea/input at the current caret position and
// return the new value. Restores the caret after React re-renders. If the
// element ref is missing, falls back to appending.
export function insertAtCaret(el, value, insert) {
  if (!el || typeof el.selectionStart !== 'number') {
    return `${value}${insert}`
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  const next = value.slice(0, start) + insert + value.slice(end)
  const caret = start + insert.length
  requestAnimationFrame(() => {
    el.focus()
    try {
      el.setSelectionRange(caret, caret)
    } catch {
      // Some input types don't support setSelectionRange — ignore.
    }
  })
  return next
}
