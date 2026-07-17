'use client'
import type { ImposterHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'
import { Button } from '../ui/Button'
import { PromptCard } from '../ui/PromptCard'

/** TV rendering of Imposter. The word is intentionally never shown until reveal. */
export function ImposterHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: ImposterHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Sharpest eyes &amp; sneakiest imposters</h2>
        <Leaderboard rows={view.leaderboard} unit="pts" />
        <Button onClick={onEnd}>Back to lobby</Button>
      </div>
    )
  }
  if (view.phase === 'word') {
    return (
      <div className="space-y-8 text-center">
        <PromptCard meta={<>Round {view.round}/{view.totalRounds}</>}>
          Check your phones 🤫
        </PromptCard>
        <p className="text-xl text-mist">
          {view.readyCount}/{view.totalPlayers} ready
        </p>
        <Button onClick={onAdvance}>Start clues</Button>
      </div>
    )
  }
  if (view.phase === 'clues') {
    return (
      <div className="space-y-8 text-center">
        <PromptCard
          meta={
            <>
              Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
            </>
          }
        >
          🎤 {view.currentSpeaker}
        </PromptCard>
        <p className="text-xl text-mist">is giving a clue (one word or short phrase)</p>
        <ol className="mx-auto flex max-w-md flex-col items-center gap-1 text-lg">
          {view.speakingOrder.map((name, i) => (
            <li
              key={name}
              className={
                name === view.currentSpeaker
                  ? 'font-bold text-chalk'
                  : i < view.speakingOrder.indexOf(view.currentSpeaker)
                    ? 'text-mist/60 line-through'
                    : 'text-mist'
              }
            >
              {i + 1}. {name}
            </li>
          ))}
        </ol>
        <Button onClick={onAdvance}>Next speaker</Button>
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
          Who&apos;s the imposter?
        </PromptCard>
        <p className="text-xl text-mist">
          {view.votedCount}/{view.totalPlayers} voted
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-6 text-center">
      <p className="text-mist">
        Round {view.round}/{view.totalRounds}
      </p>
      <h2 className="text-3xl">The word was</h2>
      <p className="text-6xl font-bold">{view.word}</p>
      <p className="text-3xl">
        The imposter was <span className="font-bold">{view.imposterNickname}</span>
      </p>
      <p
        className={`rounded-lg border px-6 py-3 text-2xl ${view.caught ? 'border-honey/60 bg-honey/15 text-honey' : 'border-punch/50 bg-punch/15 text-punch'}`}
      >
        {view.caught ? '🎯 Caught!' : '🕵️ Escaped! +2'}
      </p>
      <ul className="mx-auto flex max-w-md flex-col gap-1 text-lg">
        {view.tally.map((row) => (
          <li key={row.nickname} className="rounded-lg border border-line bg-stage px-4 py-2">
            {row.nickname}: {row.count} vote{row.count === 1 ? '' : 's'}
          </li>
        ))}
      </ul>
      <Leaderboard rows={view.leaderboard} unit="pts" />
      <Button onClick={onAdvance}>Next round</Button>
    </div>
  )
}
