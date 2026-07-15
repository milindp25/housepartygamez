/** Builds the public player URL encoded into a host lobby's QR code. */
export function buildJoinUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/join?code=${encodeURIComponent(code)}`
}
