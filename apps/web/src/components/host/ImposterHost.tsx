'use client'
import type { ImposterHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** TV rendering of Imposter. The word is intentionally never shown until reveal. */
export function ImposterHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: ImposterHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Sharpest eyes &amp; sneakiest imposters</h2>
        <Leaderboard rows={view.leaderboard} unit="pts" />
        <button onClick={onEnd} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">
          Back to lobby
        </button>
      </div>
    )
  }
  if (view.phase === 'word') {
    return (
      <div className="space-y-8 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds}
        </p>
        <h2 className="text-4xl font-bold">Check your phones 🤫</h2>
        <p className="text-xl text-slate-400">
          {view.readyCount}/{view.totalPlayers} ready
        </p>
        <button
          onClick={onAdvance}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold"
        >
          Start clues
        </button>
      </div>
    )
  }
  if (view.phase === 'clues') {
    return (
      <div className="space-y-8 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-4xl font-bold">🎤 {view.currentSpeaker}</h2>
        <p className="text-xl text-slate-400">is giving a clue (one word or short phrase)</p>
        <ol className="mx-auto flex max-w-md flex-col items-center gap-1 text-lg">
          {view.speakingOrder.map((name, i) => (
            <li
              key={name}
              className={
                name === view.currentSpeaker
                  ? 'font-bold text-white'
                  : i < view.speakingOrder.indexOf(view.currentSpeaker)
                    ? 'text-slate-600 line-through'
                    : 'text-slate-400'
              }
            >
              {i + 1}. {name}
            </li>
          ))}
        </ol>
        <button
          onClick={onAdvance}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold"
        >
          Next speaker
        </button>
      </div>
    )
  }
  if (view.phase === 'vote') {
    return (
      <div className="space-y-8 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-4xl font-bold">Who&apos;s the imposter?</h2>
        <p className="text-xl text-slate-400">
          {view.votedCount}/{view.totalPlayers} voted
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-6 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds}
      </p>
      <h2 className="text-3xl">The word was</h2>
      <p className="text-6xl font-bold">{view.word}</p>
      <p className="text-3xl">
        The imposter was <span className="font-bold">{view.imposterNickname}</span>
      </p>
      <p
        className={`rounded-lg px-6 py-3 text-2xl ${view.caught ? 'bg-emerald-700' : 'bg-rose-700'}`}
      >
        {view.caught ? '🎯 Caught!' : '🕵️ Escaped! +2'}
      </p>
      <ul className="mx-auto flex max-w-md flex-col gap-1 text-lg">
        {view.tally.map((row) => (
          <li key={row.nickname} className="rounded-lg bg-slate-800 px-4 py-2">
            {row.nickname}: {row.count} vote{row.count === 1 ? '' : 's'}
          </li>
        ))}
      </ul>
      <Leaderboard rows={view.leaderboard} unit="pts" />
      <button
        onClick={onAdvance}
        className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold"
      >
        Next round
      </button>
    </div>
  )
}
