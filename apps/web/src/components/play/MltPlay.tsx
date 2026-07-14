'use client'
import type { MltPlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** Phone rendering of Most Likely To: tap a friend. Pure renderer. */
export function MltPlay({
  view,
  onVote,
}: {
  view: MltPlayerView
  onVote: (targetId: string) => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final tally</h2>
        <Leaderboard rows={view.leaderboard} unit="votes" />
      </div>
    )
  }
  if (view.phase === 'reveal') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Most likely to {view.prompt.text}</h2>
        <ul className="space-y-2">
          {view.tally.map((row) => (
            <li
              key={row.playerId}
              className="flex justify-between rounded-lg bg-slate-800 px-4 py-3"
            >
              <span>{row.nickname}</span>
              <span>{row.count}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="space-y-4 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
      </p>
      <h2 className="text-xl font-bold">Who is most likely to {view.prompt.text}?</h2>
      {view.candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => onVote(c.id)}
          className={`block w-full rounded-2xl bg-slate-800 p-4 text-lg ${
            view.yourVote === c.id ? 'ring-4 ring-white' : view.yourVote ? 'opacity-50' : ''
          }`}
        >
          {c.nickname}
        </button>
      ))}
    </div>
  )
}
