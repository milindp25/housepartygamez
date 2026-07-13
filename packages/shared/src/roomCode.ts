/**
 * The set of characters used to build room codes.
 *
 * 24 letters: A-Z minus O and I (lookalikes of 0 and 1), so codes read
 * unambiguously when spoken aloud or typed on a phone.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

/**
 * Generate a 4-character room code drawn from {@link ROOM_CODE_ALPHABET}.
 *
 * @param random - Source of randomness returning a value in [0, 1). Injectable
 *   so tests can pass a deterministic RNG and assert an exact code; defaults to
 *   `Math.random` in production.
 * @returns A 4-character room code.
 */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}
