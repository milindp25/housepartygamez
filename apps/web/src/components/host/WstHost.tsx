'use client'
import type { WstHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'
import { PromptCard } from '../ui/PromptCard'

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
        <Button onClick={onEnd}>Back to lobby</Button>
      </div>
    )
  }
  if (view.phase === 'answer') {
    return (
      <div className="space-y-8 text-center">
        <PromptCard
          meta={
            <>
              Everyone answering privately <Countdown deadline={view.deadline} />
            </>
          }
        >
          {view.prompt.text}
        </PromptCard>
        <p className="text-xl text-mist">
          {view.answeredCount}/{view.totalPlayers} answered
        </p>
      </div>
    )
  }
  if (view.phase === 'guess') {
    return (
      <div className="space-y-8 text-center">
        <PromptCard
          meta={
            <>
              Answer {view.turn}/{view.totalTurns} <Countdown deadline={view.deadline} />
            </>
          }
        >
          {view.prompt.text}
        </PromptCard>
        <blockquote className="mx-auto max-w-3xl rounded-2xl border border-orchid/50 bg-orchid/15 p-8 text-3xl">
          &ldquo;{view.answerText}&rdquo;
        </blockquote>
        <p className="text-2xl">Who said that?</p>
        <p className="text-xl text-mist">
          {view.guessedCount}/{view.totalGuessers} guessed
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-6 text-center">
      <p className="text-mist">
        Answer {view.turn}/{view.totalTurns}
      </p>
      <blockquote className="mx-auto max-w-3xl rounded-2xl border border-orchid/50 bg-orchid/15 p-8 text-2xl">
        &ldquo;{view.answerText}&rdquo;
      </blockquote>
      <p className="text-4xl font-bold">— {view.authorNickname}</p>
      <p className="text-mist">
        {view.correctGuessers.length === 0
          ? `Nobody guessed it! +${view.totalTurns > 0 ? 'many' : ''} for ${view.authorNickname}`
          : `Got it: ${view.correctGuessers.join(', ')}`}
      </p>
      <Leaderboard rows={view.leaderboard} unit="pts" />
      <Button onClick={onAdvance}>Next</Button>
    </div>
  )
}
