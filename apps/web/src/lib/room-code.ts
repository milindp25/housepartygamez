/**
 * Uppercase a raw room-code string and strip it to at most four A–Z
 * characters. Applied to every keystroke and paste in the join-code input
 * so the field can never hold something the server would reject on shape.
 */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
}
