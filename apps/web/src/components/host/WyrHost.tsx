'use client'
import type { WyrHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/**
 * TV rendering of Would You Rather. Pure renderer: `view` in, pixels out.
 * The two callbacks are the only user actions available on the host screen
 * (advance to next round on reveal, or end the game at any time), and the
 * component itself never talks to the socket — the parent page does.
 */
export function WyrHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: WyrHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Most in the majority</h2>
        <Leaderboard rows={view.leaderboard} unit="rounds" />
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
        <Countdown deadline={'deadline' in view ? view.deadline : null} />
      </p>
      <h2 className="text-4xl font-bold">Would you rather…</h2>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-6 text-2xl">
        <div className="rounded-2xl bg-indigo-700 p-8">
          {view.prompt.a}
          {view.phase === 'reveal' && <p className="mt-4 text-5xl font-bold">{view.counts.a}</p>}
        </div>
        <div className="rounded-2xl bg-rose-700 p-8">
          {view.prompt.b}
          {view.phase === 'reveal' && <p className="mt-4 text-5xl font-bold">{view.counts.b}</p>}
        </div>
      </div>
      {view.phase === 'vote' && (
        <p className="text-xl text-slate-400">
          {view.votedCount}/{view.totalPlayers} voted
        </p>
      )}
      {view.phase === 'reveal' && (
        <button
          onClick={onAdvance}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold"
        >
          Next
        </button>
      )}
    </div>
  )
}
