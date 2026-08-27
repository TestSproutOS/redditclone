export const MEDIA_TRANSFER_MAX_BYTES = 4 * 1024 * 1024

const PUBLIC_MEDIA_KEY =
  /^(?:user-avatar|user-banner|community-icon|community-banner|post-media|link-preview)\/[0-9a-f-]{36}\/[0-9A-Za-z.-]+$/

export function isPublicMediaKey(key: string): boolean {
  return PUBLIC_MEDIA_KEY.test(key) && !key.includes("..")
}

export function mimeTypeForImageKey(key: string): string | null {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg"
  if (key.endsWith(".png")) return "image/png"
  if (key.endsWith(".gif")) return "image/gif"
  if (key.endsWith(".webp")) return "image/webp"
  return null
}
