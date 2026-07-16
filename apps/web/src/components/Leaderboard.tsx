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
          className={`flex justify-between rounded-xl border px-4 py-3 text-lg ${
            i === 0 ? 'border-honey/60 bg-honey/10' : 'border-line bg-stage'
          }`}
        >
          <span>
            {i === 0 ? '👑 ' : `${i + 1}. `}
            {r.nickname}
          </span>
          <span className="text-mist">
            {r.score} {unit}
          </span>
        </li>
      ))}
    </ol>
  )
}
