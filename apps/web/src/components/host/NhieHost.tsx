'use client'
import type { NhieHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** TV rendering of Never Have I Ever. */
export function NhieHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: NhieHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">
          {view.elimination ? 'Last one standing' : 'Most innocent'}
        </h2>
        <Leaderboard rows={view.leaderboard} unit={view.elimination ? 'strikes' : '"I have"s'} />
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
        {view.phase === 'answer' && <Countdown deadline={view.deadline} />}
      </p>
      <h2 className="text-4xl font-bold">Never have I ever {view.prompt.text}</h2>
      {view.phase === 'answer' && (
        <p className="text-xl text-slate-400">
          {view.answeredCount}/{view.totalPlayers} answered
        </p>
      )}
      {view.phase === 'reveal' && (
        <>
          <p className="text-7xl font-bold">{view.yesCount}</p>
          <p className="text-slate-400">
            {view.yesCount === 1 ? 'person has' : 'people have'}
          </p>
          {view.yesNames && view.yesNames.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2">
              {view.yesNames.map((n) => (
                <li key={n} className="rounded-full bg-rose-700 px-4 py-2">
                  {n}
                </li>
              ))}
            </ul>
          )}
          {view.eliminatedNow.length > 0 && (
            <p className="rounded-lg bg-amber-600 px-4 py-2">
              Eliminated: {view.eliminatedNow.join(', ')} 🍿
            </p>
          )}
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
