'use client'
import type { ImposterPlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/**
 * Phone rendering of Imposter. The imposter's device NEVER receives the
 * secret word — it is stripped by `imposter.playerView` on the server.
 * That's the info-hiding guarantee even if a suspicious player pops open
 * devtools during the game.
 */
export function ImposterPlay({
  view,
  onReady,
  onVote,
}: {
  view: ImposterPlayerView
  onReady: () => void
  onVote: (suspectId: string) => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final results</h2>
        <Leaderboard rows={view.leaderboard} unit="pts" />
      </div>
    )
  }
  if (view.phase === 'word') {
    return (
      <div className="space-y-6 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds}
        </p>
        {view.isImposter ? (
          <div className="space-y-4 rounded-2xl bg-rose-800 p-6">
            <p className="text-2xl font-bold">🕵️ You are the IMPOSTER</p>
            {view.hint && (
              <p className="text-lg">
                Category: <span className="font-bold">{view.hint}</span>
              </p>
            )}
            <p className="text-slate-300">Blend in. Give a plausible one-word clue.</p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-indigo-700 p-6">
            <p className="text-lg text-slate-300">The word is</p>
            <p className="text-4xl font-bold">{view.word}</p>
            <p className="text-slate-300">Don&apos;t say it. Give a related clue.</p>
          </div>
        )}
        {view.ready ? (
          <p className="text-slate-400">Waiting for others…</p>
        ) : (
          <button
            onClick={onReady}
            className="rounded-lg bg-emerald-600 px-8 py-4 text-xl font-bold"
          >
            Got it
          </button>
        )}
      </div>
    )
  }
  if (view.phase === 'clues') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <div className="rounded-lg bg-slate-800 p-3 text-sm">
          {view.isImposter ? (
            <>🕵️ You&apos;re the imposter{view.hint ? ` — category: ${view.hint}` : ''}</>
          ) : (
            <>Word: {view.word}</>
          )}
        </div>
        <p className="text-2xl font-bold">
          {view.youAreSpeaking ? '🎤 Your turn — say a clue' : `${view.currentSpeaker} is speaking`}
        </p>
      </div>
    )
  }
  if (view.phase === 'vote') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-xl font-bold">Who&apos;s the imposter?</h2>
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
  return (
    <div className="space-y-4 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds}
      </p>
      <p className="text-lg">The word was</p>
      <p className="text-4xl font-bold">{view.word}</p>
      <p className="text-lg">
        Imposter: <span className="font-bold">{view.imposterNickname}</span>
      </p>
      <p
        className={`rounded-lg px-4 py-2 text-lg ${view.caught ? 'bg-emerald-700' : 'bg-rose-700'}`}
      >
        {view.caught ? '🎯 Caught!' : '🕵️ Escaped! +2'}
      </p>
    </div>
  )
}
