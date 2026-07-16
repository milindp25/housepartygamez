'use client'
import type { WyrHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'
import { PromptCard } from '../ui/PromptCard'

/**
 * TV rendering of Would You Rather. Pure renderer: `view` in, pixels out.
 * The two callbacks are the only user actions available on the host screen
 * (advance to next round on reveal, or end the game at any time), and the
 * component itself never talks to the socket — the parent page does.
 */
export function WyrHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: WyrHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Most in the majority</h2>
        <Leaderboard rows={view.leaderboard} unit="rounds" />
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
            <Countdown deadline={'deadline' in view ? view.deadline : null} />
          </>
        }
      >
        Would you rather…
      </PromptCard>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-6 text-2xl">
        <div className="rounded-2xl border border-orchid/50 bg-orchid/15 p-8">
          {view.prompt.a}
          {view.phase === 'reveal' && <p className="mt-4 text-5xl font-bold">{view.counts.a}</p>}
        </div>
        <div className="rounded-2xl border border-punch/50 bg-punch/15 p-8">
          {view.prompt.b}
          {view.phase === 'reveal' && <p className="mt-4 text-5xl font-bold">{view.counts.b}</p>}
        </div>
      </div>
      {view.phase === 'vote' && (
        <p className="text-xl text-mist">
          {view.votedCount}/{view.totalPlayers} voted
        </p>
      )}
      {view.phase === 'reveal' && <Button onClick={onAdvance}>Next</Button>}
    </div>
  )
}
