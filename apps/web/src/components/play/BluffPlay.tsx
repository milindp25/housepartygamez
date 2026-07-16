'use client'
import { useState } from 'react'
import type { BluffPlayerView, GameInputResult } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'

/** Phone rendering of Bluff Battle across bluff, vote, reveal, and final phases. */
export function BluffPlay({
  view,
  onSubmitBluff,
  onPick,
}: {
  view: BluffPlayerView
  onSubmitBluff: (text: string) => Promise<GameInputResult>
  onPick: (optionId: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [truthMatch, setTruthMatch] = useState(false)
  const [submissionError, setSubmissionError] = useState(false)
  const [awaiting, setAwaiting] = useState(false)

  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final results</h2>
        <Leaderboard rows={view.leaderboard} unit="pts" />
      </div>
    )
  }

  if (view.phase === 'bluff') {
    if (view.submitted) {
      return (
        <div className="space-y-4 text-center">
          <p className="text-mist">
            Waiting for others… <Countdown deadline={view.deadline} />
          </p>
          <p className="rounded-lg border border-line bg-stage p-6 text-lg">Bluff locked in 😈</p>
        </div>
      )
    }
    const submit = async () => {
      const bluff = draft.trim()
      if (!bluff) return
      setTruthMatch(false)
      setSubmissionError(false)
      setAwaiting(true)
      try {
        const result = await onSubmitBluff(bluff)
        if (!result.ok) setSubmissionError(true)
        else if (!result.accepted && result.reason === 'matches-truth') setTruthMatch(true)
        else if (!result.accepted) setSubmissionError(true)
      } catch {
        setSubmissionError(true)
      } finally {
        setAwaiting(false)
      }
    }
    return (
      <div className="space-y-4 text-center">
        <p className="text-mist">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-xl font-bold">{view.question}</h2>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={100}
          placeholder="Your bluff (max 100 chars)"
          className="w-full rounded-lg border border-line bg-stage p-4 text-lg text-chalk placeholder:text-mist"
          rows={3}
        />
        <Button onClick={submit} disabled={!draft.trim() || awaiting}>
          {awaiting ? 'Submitting…' : 'Submit bluff'}
        </Button>
        {truthMatch && (
          <p role="alert" className="text-honey">
            That&apos;s the real answer — too easy! Try another.
          </p>
        )}
        {submissionError && (
          <p role="alert" className="text-red-400">
            Couldn&apos;t submit that. Check your connection and try again.
          </p>
        )}
      </div>
    )
  }

  if (view.phase === 'vote') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-mist">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-xl font-bold">Pick the real answer</h2>
        <p>{view.question}</p>
        <div className="space-y-3">
          {view.options.map((option) => (
            <button
              key={option.id}
              onClick={() => onPick(option.id)}
              disabled={option.yours || view.yourPick !== null}
              className={`block w-full rounded-2xl border border-line bg-stage p-4 text-lg ${
                view.yourPick === option.id
                  ? 'ring-4 ring-honey'
                  : view.yourPick !== null
                    ? 'opacity-50'
                    : ''
              } disabled:cursor-not-allowed`}
            >
              {option.text}
              {option.yours && (
                <span className="ml-2 rounded-full bg-orchid/30 px-2 py-1 text-xs">yours</span>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-center">
      <p className="text-mist">
        Round {view.round}/{view.totalRounds}
      </p>
      <h2 className="text-xl font-bold">{view.question}</h2>
      <p className="rounded-2xl border border-honey/60 bg-honey/15 text-honey p-5 text-2xl font-bold">
        Real answer: {view.truth}
      </p>
      <div className="space-y-3">
        {view.results.map((result) => (
          <div
            key={result.text}
            className={`rounded-xl p-4 text-left ${result.isTruth ? 'border border-honey/60 bg-honey/10' : 'border border-line bg-stage'}`}
          >
            <p className="font-bold">
              {result.text} {result.isTruth && <span className="text-honey">✓ truth</span>}
            </p>
            {!result.isTruth && (
              <p className="text-sm text-chalk/80">
                {result.authors.length > 0 ? `By ${result.authors.join(', ')}` : 'No authors'}
              </p>
            )}
            <p className="text-sm text-mist">
              {result.pickedBy.length > 0
                ? `Fooled: ${result.pickedBy.join(', ')}`
                : 'Nobody picked this'}
            </p>
          </div>
        ))}
      </div>
      <Leaderboard rows={view.leaderboard} unit="pts" />
    </div>
  )
}
