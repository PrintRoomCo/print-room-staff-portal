export const MAX_ECOMMERCE_UPLOADS = 14
export const MAX_ECOMMERCE_UPLOAD_BYTES = 20 * 1024 * 1024
export const ACCEPTED_ECOMMERCE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function isAcceptedEcommerceMimeType(mimeType: string): boolean {
  return ACCEPTED_ECOMMERCE_MIME_TYPES.includes(mimeType as (typeof ACCEPTED_ECOMMERCE_MIME_TYPES)[number])
}

export function getReadableFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getBaseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}
