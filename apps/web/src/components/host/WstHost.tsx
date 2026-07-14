'use client'
import type { WstHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** TV rendering of Who Said That. */
export function WstHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: WstHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Best guessers &amp; sneakiest authors</h2>
        <Leaderboard rows={view.leaderboard} unit="pts" />
        <button onClick={onEnd} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">
          Back to lobby
        </button>
      </div>
    )
  }
  if (view.phase === 'answer') {
    return (
      <div className="space-y-8 text-center">
        <p className="text-slate-400">
          Everyone answering privately <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-4xl font-bold">{view.prompt.text}</h2>
        <p className="text-xl text-slate-400">
          {view.answeredCount}/{view.totalPlayers} answered
        </p>
      </div>
    )
  }
  if (view.phase === 'guess') {
    return (
      <div className="space-y-8 text-center">
        <p className="text-slate-400">
          Answer {view.turn}/{view.totalTurns} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-2xl font-bold text-slate-400">{view.prompt.text}</h2>
        <blockquote className="mx-auto max-w-3xl rounded-2xl bg-indigo-700 p-8 text-3xl">
          &ldquo;{view.answerText}&rdquo;
        </blockquote>
        <p className="text-2xl">Who said that?</p>
        <p className="text-xl text-slate-400">
          {view.guessedCount}/{view.totalGuessers} guessed
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-6 text-center">
      <p className="text-slate-400">
        Answer {view.turn}/{view.totalTurns}
      </p>
      <blockquote className="mx-auto max-w-3xl rounded-2xl bg-indigo-700 p-8 text-2xl">
        &ldquo;{view.answerText}&rdquo;
      </blockquote>
      <p className="text-4xl font-bold">— {view.authorNickname}</p>
      <p className="text-slate-400">
        {view.correctGuessers.length === 0
          ? `Nobody guessed it! +${view.totalTurns > 0 ? 'many' : ''} for ${view.authorNickname}`
          : `Got it: ${view.correctGuessers.join(', ')}`}
      </p>
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
