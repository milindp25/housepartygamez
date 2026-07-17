'use client'
import type { NhiePlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** Phone rendering of Never Have I Ever: private yes/no. */
export function NhiePlay({
  view,
  onAnswer,
}: {
  view: NhiePlayerView
  onAnswer: (done: boolean) => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final results</h2>
        <Leaderboard rows={view.leaderboard} unit={view.elimination ? 'strikes' : '"I have"s'} />
      </div>
    )
  }
  if (view.phase === 'reveal') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Never have I ever {view.prompt.text}</h2>
        <p className="text-5xl font-bold">{view.yesCount}</p>
        {view.yesNames && view.yesNames.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2">
            {view.yesNames.map((n) => (
              <li key={n} className="rounded-full border border-punch/50 bg-punch/15 px-3 py-1">
                {n}
              </li>
            ))}
          </ul>
        )}
        {view.eliminatedNow.length > 0 && (
          <p className="rounded-lg border border-honey/60 bg-honey/15 text-honey px-4 py-2">
            Out: {view.eliminatedNow.join(', ')}
          </p>
        )}
      </div>
    )
  }
  if (view.eliminated) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Never have I ever {view.prompt.text}</h2>
        <p className="rounded-lg border border-line bg-stage p-6 text-lg">
          You&apos;re out — enjoy the show 🍿
        </p>
      </div>
    )
  }
  const picked = view.yourAnswer
  return (
    <div className="space-y-4 text-center">
      <p className="text-mist">
        Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
      </p>
      <h2 className="text-xl font-bold">Never have I ever {view.prompt.text}</h2>
      <button
        onClick={() => onAnswer(true)}
        className={`block w-full rounded-2xl border border-punch/50 bg-punch/15 p-6 text-lg ${
          picked === true ? 'ring-4 ring-honey' : picked !== null ? 'opacity-50' : ''
        }`}
      >
        I have 🙋
      </button>
      <button
        onClick={() => onAnswer(false)}
        className={`block w-full rounded-2xl border border-orchid/50 bg-orchid/15 p-6 text-lg ${
          picked === false ? 'ring-4 ring-honey' : picked !== null ? 'opacity-50' : ''
        }`}
      >
        Never 😇
      </button>
      {picked !== null && (
        <p className="text-mist">Answer locked — tap the other to change</p>
      )}
    </div>
  )
}
