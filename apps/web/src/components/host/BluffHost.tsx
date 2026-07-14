'use client'
import type { BluffHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** TV rendering of Bluff Battle across bluff, vote, reveal, and final phases. */
export function BluffHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: BluffHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Best bluffers &amp; truth seekers</h2>
        <Leaderboard rows={view.leaderboard} unit="pts" />
        <button onClick={onEnd} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">
          Back to lobby
        </button>
      </div>
    )
  }

  if (view.phase === 'bluff') {
    return (
      <div className="space-y-8 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="max-w-5xl text-5xl font-bold">{view.question}</h2>
        <p className="text-xl text-slate-400">
          {view.submittedCount}/{view.totalPlayers} submitted
        </p>
      </div>
    )
  }

  if (view.phase === 'vote') {
    return (
      <div className="space-y-8 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-4xl font-bold">{view.question}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {view.options.map((option) => (
            <div key={option.id} className="rounded-2xl bg-slate-800 p-6 text-2xl">
              {option.text}
            </div>
          ))}
        </div>
        <p className="text-xl text-slate-400">
          {view.pickedCount}/{view.totalPlayers} picked
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds}
      </p>
      <h2 className="text-3xl font-bold">{view.question}</h2>
      <p className="rounded-2xl bg-emerald-700 p-6 text-4xl font-bold">
        Real answer: {view.truth}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {view.results.map((result) => (
          <div
            key={result.text}
            className={`rounded-xl p-4 text-left ${result.isTruth ? 'bg-emerald-800' : 'bg-slate-800'}`}
          >
            <p className="text-xl font-bold">
              {result.text} {result.isTruth && '✓ truth'}
            </p>
            {!result.isTruth && <p>By {result.authors.join(', ') || 'nobody'}</p>}
            <p className="text-slate-400">
              {result.pickedBy.length > 0
                ? `Picked by ${result.pickedBy.join(', ')}`
                : 'Nobody picked this'}
            </p>
          </div>
        ))}
      </div>
      <Leaderboard rows={view.leaderboard} unit="pts" />
      <button
        onClick={onAdvance}
        className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold"
      >
        Next
      </button>
    </div>
  )
}
