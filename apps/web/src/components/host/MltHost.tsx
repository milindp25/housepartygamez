'use client'
import type { MltHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** TV rendering of Most Likely To. Pure renderer: state in, pixels out. */
export function MltHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: MltHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Most voted overall</h2>
        <Leaderboard rows={view.leaderboard} unit="votes" />
        <button onClick={onEnd} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">
          Back to lobby
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-8 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds}{' '}
        {view.phase === 'vote' && <Countdown deadline={view.deadline} />}
      </p>
      <h2 className="text-4xl font-bold">Who is most likely to {view.prompt.text}?</h2>
      {view.phase === 'vote' && (
        <p className="text-xl text-slate-400">
          {view.votedCount}/{view.totalPlayers} voted
        </p>
      )}
      {view.phase === 'reveal' && (
        <>
          <ul className="mx-auto w-full max-w-md space-y-2">
            {view.tally.map((row) => (
              <li
                key={row.playerId}
                className="flex justify-between rounded-lg bg-slate-800 px-4 py-3 text-xl"
              >
                <span>{row.nickname}</span>
                <span>
                  {'🔥'.repeat(row.count)} {row.count}
                  {row.voters && row.voters.length > 0 && (
                    <span className="ml-2 text-sm text-slate-400">
                      ({row.voters.join(', ')})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={onAdvance}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold"
          >
            Next
          </button>
        </>
      )}
    </div>
  )
}
