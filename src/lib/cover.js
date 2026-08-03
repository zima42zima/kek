// A cover value is either an uploaded image (data:/http URL) or a solid color
// string (e.g. "#3fae6b"). These helpers let the UI treat both uniformly.

export function isImageCover(value) {
  return typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'))
}

export function isColorCover(value) {
  return typeof value === 'string' && value.length > 0 && !isImageCover(value)
}

export function coverBackground(value) {
  return isColorCover(value) ? value : 'transparent'
}
