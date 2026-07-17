'use client'
import type { WyrChoice, WyrPlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/**
 * Phone rendering of Would You Rather. Pure renderer — the parent page
 * emits `game:input` on `onVote`. During `vote`, tapping either option
 * locks (or re-locks) that choice. During `reveal`, the buttons are
 * disabled and show the group split; the picked option keeps its highlight.
 */
export function WyrPlay({
  view,
  onVote,
}: {
  view: WyrPlayerView
  onVote: (choice: WyrChoice) => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final results</h2>
        <Leaderboard rows={view.leaderboard} unit="rounds" />
      </div>
    )
  }
  const picked = view.yourChoice
  return (
    <div className="space-y-6 text-center">
      <p className="text-mist">
        Round {view.round}/{view.totalRounds}{' '}
        {view.phase === 'vote' && <Countdown deadline={view.deadline} />}
      </p>
      <h2 className="text-xl font-bold">Would you rather…</h2>
      {(['a', 'b'] as const).map((c) => (
        <button
          key={c}
          disabled={view.phase !== 'vote'}
          onClick={() => onVote(c)}
          className={`block w-full rounded-2xl p-6 text-lg ${
            c === 'a' ? 'border border-orchid/50 bg-orchid/15' : 'border border-punch/50 bg-punch/15'
          } ${picked === c ? 'ring-4 ring-honey' : picked ? 'opacity-50' : ''}`}
        >
          {view.prompt[c]}
          {view.phase === 'reveal' && (
            <span className="ml-2 font-bold">({view.counts[c]})</span>
          )}
        </button>
      ))}
      {view.phase === 'vote' && picked && (
        <p className="text-mist">Vote locked — tap to change</p>
      )}
      {view.phase === 'reveal' && (
        <p className="text-mist">
          {view.majority === 'tie' ? 'Dead tie!' : 'Majority wins a point'}
        </p>
      )}
    </div>
  )
}
