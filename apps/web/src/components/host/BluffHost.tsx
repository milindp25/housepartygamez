'use client'
import type { BluffHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'
import { PromptCard } from '../ui/PromptCard'

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
        <Button onClick={onEnd}>Back to lobby</Button>
      </div>
    )
  }

  if (view.phase === 'bluff') {
    return (
      <div className="space-y-8 text-center">
        <PromptCard
          meta={
            <>
              Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
            </>
          }
          className="mx-auto max-w-5xl"
        >
          {view.question}
        </PromptCard>
        <p className="text-xl text-mist">
          {view.submittedCount}/{view.totalPlayers} submitted
        </p>
      </div>
    )
  }

  if (view.phase === 'vote') {
    return (
      <div className="space-y-8 text-center">
        <PromptCard
          meta={
            <>
              Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
            </>
          }
        >
          {view.question}
        </PromptCard>
        <div className="grid gap-4 sm:grid-cols-2">
          {view.options.map((option) => (
            <div key={option.id} className="rounded-2xl border border-line bg-stage p-6 text-2xl">
              {option.text}
            </div>
          ))}
        </div>
        <p className="text-xl text-mist">
          {view.pickedCount}/{view.totalPlayers} picked
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-center">
      <p className="text-mist">
        Round {view.round}/{view.totalRounds}
      </p>
      <h2 className="text-3xl font-bold">{view.question}</h2>
      <p className="rounded-2xl border border-honey/60 bg-honey/15 text-honey p-6 text-4xl font-bold">
        Real answer: {view.truth}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {view.results.map((result) => (
          <div
            key={result.text}
            className={`rounded-xl p-4 text-left ${result.isTruth ? 'border border-honey/60 bg-honey/10' : 'border border-line bg-stage'}`}
          >
            <p className="text-xl font-bold">
              {result.text} {result.isTruth && '✓ truth'}
            </p>
            {!result.isTruth && <p>By {result.authors.join(', ') || 'nobody'}</p>}
            <p className="text-mist">
              {result.pickedBy.length > 0
                ? `Picked by ${result.pickedBy.join(', ')}`
                : 'Nobody picked this'}
            </p>
          </div>
        ))}
      </div>
      <Leaderboard rows={view.leaderboard} unit="pts" />
      <Button onClick={onAdvance}>Next</Button>
    </div>
  )
}
