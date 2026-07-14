/**
 * One pending TIMER_EXPIRED per room.
 *
 * Reducers own the *deadline* (an epoch-ms field on state), and this class
 * owns the `setTimeout` handles that fire when a deadline passes. `reschedule`
 * diffs the room's current deadline against what's already scheduled and
 * (re)arms or clears accordingly, so every action's re-broadcast is cheap and
 * we never double-fire.
 *
 * Centralising handles here means room deletion has one place to `clear` —
 * a swept room can never leak a live timer holding a reference to stale state.
 */
export class RoomTimers {
  private handles = new Map<string, { deadline: number; handle: NodeJS.Timeout }>()

  /**
   * Arm (or re-arm) the timer for `code` to fire at `deadline`. Passing
   * `deadline === null` clears any pending timer for the room.
   *
   * @param onExpire - Called (with no arguments) when the deadline passes.
   *   Should dispatch a `TIMER_EXPIRED` action; this class does not know or
   *   care about the game reducer.
   */
  reschedule(code: string, deadline: number | null, onExpire: () => void): void {
    const existing = this.handles.get(code)
    if (existing && existing.deadline === deadline) return
    if (existing) clearTimeout(existing.handle)
    this.handles.delete(code)
    if (deadline === null) return
    const handle = setTimeout(
      () => {
        this.handles.delete(code)
        onExpire()
      },
      Math.max(0, deadline - Date.now()),
    )
    this.handles.set(code, { deadline, handle })
  }

  /** Clear any pending timer for `code`. Called on room expiry and game end. */
  clear(code: string): void {
    const existing = this.handles.get(code)
    if (existing) clearTimeout(existing.handle)
    this.handles.delete(code)
  }
}
