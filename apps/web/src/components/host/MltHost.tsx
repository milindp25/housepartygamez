'use client'
import type { MltHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'
import { PromptCard } from '../ui/PromptCard'

/** TV rendering of Most Likely To. Pure renderer: state in, pixels out. */
export function MltHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: MltHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Most voted overall</h2>
        <Leaderboard rows={view.leaderboard} unit="votes" />
        <Button onClick={onEnd}>Back to lobby</Button>
      </div>
    )
  }
  return (
    <div className="space-y-8 text-center">
      <PromptCard
        meta={
          <>
            Round {view.round}/{view.totalRounds}{' '}
            {view.phase === 'vote' && <Countdown deadline={view.deadline} />}
          </>
        }
      >
        Who is most likely to {view.prompt.text}?
      </PromptCard>
      {view.phase === 'vote' && (
        <p className="text-xl text-mist">
          {view.votedCount}/{view.totalPlayers} voted
        </p>
      )}
      {view.phase === 'reveal' && (
        <>
          <ul className="mx-auto w-full max-w-md space-y-2">
            {view.tally.map((row) => (
              <li
                key={row.playerId}
                className="flex justify-between rounded-lg border border-line bg-stage px-4 py-3 text-xl"
              >
                <span>{row.nickname}</span>
                <span>
                  {'🔥'.repeat(row.count)} {row.count}
                  {row.voters && row.voters.length > 0 && (
                    <span className="ml-2 text-sm text-mist">
                      ({row.voters.join(', ')})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Button onClick={onAdvance}>Next</Button>
        </>
      )}
    </div>
  )
}
