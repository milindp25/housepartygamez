'use client'
import type { ImposterPlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'

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
        <p className="text-mist">
          Round {view.round}/{view.totalRounds}
        </p>
        {view.isImposter ? (
          <div className="space-y-4 rounded-2xl border border-punch/50 bg-punch/15 p-6">
            <p className="text-2xl font-bold">🕵️ You are the IMPOSTER</p>
            {view.hint && (
              <p className="text-lg">
                Category: <span className="font-bold">{view.hint}</span>
              </p>
            )}
            <p className="text-chalk/80">Blend in. Give a plausible one-word clue.</p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-orchid/50 bg-orchid/15 p-6">
            <p className="text-lg text-chalk/80">The word is</p>
            <p className="text-4xl font-bold">{view.word}</p>
            <p className="text-chalk/80">Don&apos;t say it. Give a related clue.</p>
          </div>
        )}
        {view.ready ? (
          <p className="text-mist">Waiting for others…</p>
        ) : (
          <Button size="lg" onClick={onReady}>
            Got it
          </Button>
        )}
      </div>
    )
  }
  if (view.phase === 'clues') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-mist">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <div className="rounded-lg border border-line bg-stage p-3 text-sm">
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
        <p className="text-mist">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-xl font-bold">Who&apos;s the imposter?</h2>
        {view.candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onVote(c.id)}
            className={`block w-full rounded-2xl border border-line bg-stage p-4 text-lg ${
              view.yourVote === c.id ? 'ring-4 ring-honey' : view.yourVote ? 'opacity-50' : ''
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
      <p className="text-mist">
        Round {view.round}/{view.totalRounds}
      </p>
      <p className="text-lg">The word was</p>
      <p className="text-4xl font-bold">{view.word}</p>
      <p className="text-lg">
        Imposter: <span className="font-bold">{view.imposterNickname}</span>
      </p>
      <p
        className={`rounded-lg border px-4 py-2 text-lg ${view.caught ? 'border-honey/60 bg-honey/15 text-honey' : 'border-punch/50 bg-punch/15 text-punch'}`}
      >
        {view.caught ? '🎯 Caught!' : '🕵️ Escaped! +2'}
      </p>
    </div>
  )
}
