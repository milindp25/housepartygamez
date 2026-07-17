'use client'
import { useState } from 'react'
import type { WstPlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'

/**
 * Phone rendering of Who Said That. In `answer` phase we render a small
 * form (textarea + submit); in `guess` phase we render candidate buttons
 * unless the on-screen answer is the player's own ("act natural" hint).
 */
export function WstPlay({
  view,
  onSubmitAnswer,
  onGuess,
}: {
  view: WstPlayerView
  onSubmitAnswer: (text: string) => void
  onGuess: (authorId: string) => void
}) {
  const [draft, setDraft] = useState('')

  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final results</h2>
        <Leaderboard rows={view.leaderboard} unit="pts" />
      </div>
    )
  }

  if (view.phase === 'answer') {
    if (view.submitted) {
      return (
        <div className="space-y-4 text-center">
          <p className="text-mist">
            Waiting for others… <Countdown deadline={view.deadline} />
          </p>
          <p className="rounded-lg border border-line bg-stage p-6 text-lg">Answer in ✅</p>
        </div>
      )
    }
    return (
      <div className="space-y-4 text-center">
        <p className="text-mist">
          Answer privately <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-xl font-bold">{view.prompt.text}</h2>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={140}
          placeholder="Your answer (max 140 chars)"
          className="w-full rounded-lg border border-line bg-stage p-4 text-lg text-chalk placeholder:text-mist"
          rows={3}
        />
        <Button onClick={() => draft.trim() && onSubmitAnswer(draft.trim())} disabled={!draft.trim()}>
          Submit
        </Button>
      </div>
    )
  }

  if (view.phase === 'guess') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-mist">
          Answer {view.turn}/{view.totalTurns} <Countdown deadline={view.deadline} />
        </p>
        <blockquote className="rounded-2xl border border-orchid/50 bg-orchid/15 p-6 text-lg">
          &ldquo;{view.answerText}&rdquo;
        </blockquote>
        {view.isYours ? (
          <p className="rounded-lg border border-line bg-stage p-6 text-lg">
            This one&apos;s yours 🤫 act natural
          </p>
        ) : (
          view.candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => onGuess(c.id)}
              className={`block w-full rounded-2xl border border-line bg-stage p-4 text-lg ${
                view.yourGuess === c.id
                  ? 'ring-4 ring-honey'
                  : view.yourGuess
                    ? 'opacity-50'
                    : ''
              }`}
            >
              {c.nickname}
            </button>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <blockquote className="rounded-2xl border border-orchid/50 bg-orchid/15 p-6 text-lg">
        &ldquo;{view.answerText}&rdquo;
      </blockquote>
      <p className="text-3xl font-bold">— {view.authorNickname}</p>
      <p className="text-mist">
        {view.correctGuessers.length === 0
          ? 'Nobody guessed it!'
          : `Got it: ${view.correctGuessers.join(', ')}`}
      </p>
    </div>
  )
}
