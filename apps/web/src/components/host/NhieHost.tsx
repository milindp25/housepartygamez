'use client'
import type { NhieHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'
import { PromptCard } from '../ui/PromptCard'

/** TV rendering of Never Have I Ever. */
export function NhieHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: NhieHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">
          {view.elimination ? 'Last one standing' : 'Most innocent'}
        </h2>
        <Leaderboard rows={view.leaderboard} unit={view.elimination ? 'strikes' : '"I have"s'} />
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
            {view.phase === 'answer' && <Countdown deadline={view.deadline} />}
          </>
        }
      >
        Never have I ever {view.prompt.text}
      </PromptCard>
      {view.phase === 'answer' && (
        <p className="text-xl text-mist">
          {view.answeredCount}/{view.totalPlayers} answered
        </p>
      )}
      {view.phase === 'reveal' && (
        <>
          <p className="text-7xl font-bold">{view.yesCount}</p>
          <p className="text-mist">
            {view.yesCount === 1 ? 'person has' : 'people have'}
          </p>
          {view.yesNames && view.yesNames.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2">
              {view.yesNames.map((n) => (
                <li key={n} className="rounded-full border border-punch/50 bg-punch/15 px-4 py-2">
                  {n}
                </li>
              ))}
            </ul>
          )}
          {view.eliminatedNow.length > 0 && (
            <p className="rounded-lg border border-honey/60 bg-honey/15 text-honey px-4 py-2">
              Eliminated: {view.eliminatedNow.join(', ')} 🍿
            </p>
          )}
          <Button onClick={onAdvance}>Next</Button>
        </>
      )}
    </div>
  )
}
