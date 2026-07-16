/**
 * Lobby player list. Connected players get a warm chip with a pop-in
 * animation (reduced-motion gated in globals.css); disconnected players
 * stay muted with a line-through, matching the pre-redesign semantics.
 * Chip text is the nickname ONLY — e2e specs match it exactly.
 */
export function PlayerChips({
  players,
}: {
  players: Array<{ id: string; nickname: string; connected: boolean }>
}) {
  return (
    <ul className="flex flex-wrap justify-center gap-3">
      {players.map((p) => (
        <li
          key={p.id}
          className={`player-chip rounded-full px-4 py-2 text-lg ${
            p.connected
              ? 'border border-honey/40 bg-stage text-chalk'
              : 'border border-line bg-stage/50 text-mist line-through'
          }`}
        >
          {p.nickname}
        </li>
      ))}
    </ul>
  )
}
