/**
 * Final-score list shared by every game's finished screen. Rows are
 * pre-sorted server-side, so index 0 is the leader and gets the crown.
 */
export function Leaderboard({
  rows,
  unit,
}: {
  rows: Array<{ playerId: string; nickname: string; score: number }>
  unit: string
}) {
  return (
    <ol className="mx-auto w-full max-w-md space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.playerId}
          className="flex justify-between rounded-lg bg-slate-800 px-4 py-3 text-lg"
        >
          <span>
            {i === 0 ? '👑 ' : `${i + 1}. `}
            {r.nickname}
          </span>
          <span className="text-slate-400">
            {r.score} {unit}
          </span>
        </li>
      ))}
    </ol>
  )
}
