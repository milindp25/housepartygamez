'use client'
import { useState } from 'react'
import type { BluffPlayerView, GameInputResult } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

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
          <p className="text-slate-400">
            Waiting for others… <Countdown deadline={view.deadline} />
          </p>
          <p className="rounded-lg bg-slate-800 p-6 text-lg">Bluff locked in 😈</p>
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
        <p className="text-slate-400">
          Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
        </p>
        <h2 className="text-xl font-bold">{view.question}</h2>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={100}
          placeholder="Your bluff (max 100 chars)"
          className="w-full rounded-lg bg-slate-800 p-4 text-lg"
          rows={3}
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || awaiting}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold disabled:opacity-40"
        >
          {awaiting ? 'Submitting…' : 'Submit bluff'}
        </button>
        {truthMatch && (
          <p role="alert" className="text-amber-300">
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
        <p className="text-slate-400">
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
              className={`block w-full rounded-2xl bg-slate-800 p-4 text-lg ${
                view.yourPick === option.id
                  ? 'ring-4 ring-white'
                  : view.yourPick !== null
                    ? 'opacity-50'
                    : ''
              } disabled:cursor-not-allowed`}
            >
              {option.text}
              {option.yours && (
                <span className="ml-2 rounded-full bg-indigo-600 px-2 py-1 text-xs">yours</span>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds}
      </p>
      <h2 className="text-xl font-bold">{view.question}</h2>
      <p className="rounded-2xl bg-emerald-700 p-5 text-2xl font-bold">
        Real answer: {view.truth}
      </p>
      <div className="space-y-3">
        {view.results.map((result) => (
          <div
            key={result.text}
            className={`rounded-xl p-4 text-left ${result.isTruth ? 'bg-emerald-800' : 'bg-slate-800'}`}
          >
            <p className="font-bold">
              {result.text} {result.isTruth && <span className="text-emerald-300">✓ truth</span>}
            </p>
            {!result.isTruth && (
              <p className="text-sm text-slate-300">
                {result.authors.length > 0 ? `By ${result.authors.join(', ')}` : 'No authors'}
              </p>
            )}
            <p className="text-sm text-slate-400">
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
