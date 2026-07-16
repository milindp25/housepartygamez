'use client'
import type { MafiaHostView, MafiaRole } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Button } from '../ui/Button'

const ROLE_LABELS: Record<MafiaRole, string> = {
  mafia: '🔪 MAFIA',
  detective: '🕵️ DETECTIVE',
  doctor: '💉 DOCTOR',
  civilian: '👤 CIVILIAN',
}

function dayAnnouncement(view: Extract<MafiaHostView, { phase: 'day' }>): string {
  if (view.lastNight.saved) return 'The Doctor saved someone last night!'
  if (view.lastNight.killedNickname) {
    return `☀️ ${view.lastNight.killedNickname} was found eliminated`
  }
  return '☀️ No one was eliminated last night'
}

function playerGrid(view: MafiaHostView): React.ReactNode {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {view.players.map((player) => (
        <li
          key={player.id}
          className={`rounded-xl border px-4 py-3 text-center text-lg font-bold ${
            player.alive
              ? 'border-line bg-stage text-chalk'
              : 'border-line/50 bg-plum/60 text-mist/50 line-through'
          }`}
        >
          {!player.alive && '💀 '}
          {player.nickname}
        </li>
      ))}
    </ul>
  )
}

/** Public TV rendering for Mafia; living roles never appear in its props. */
export function MafiaHost({
  view,
  onAdvance,
  onEnd,
}: {
  view: MafiaHostView
  onAdvance: () => void
  onEnd: () => void
}) {
  let phase: React.ReactNode
  if (view.phase === 'night') {
    phase = (
      <section className="space-y-5 text-center">
        <h2 className="text-5xl font-black">🌙 Night {view.day} — the town sleeps</h2>
        <p className="text-xl text-orchid">
          {view.actionsDone}/{view.actionsNeeded} night actions complete
        </p>
        <Countdown deadline={view.deadline} />
      </section>
    )
  } else if (view.phase === 'day') {
    phase = (
      <section className="space-y-6 text-center">
        <h2 className="max-w-5xl text-5xl font-black">{dayAnnouncement(view)}</h2>
        <p className="text-2xl text-honey">Discuss out loud. Find the Mafia.</p>
        <Countdown deadline={view.deadline} />
        <div>
          <Button size="lg" onClick={onAdvance}>
            Start the vote
          </Button>
        </div>
      </section>
    )
  } else if (view.phase === 'vote') {
    phase = (
      <section className="space-y-5 text-center">
        <h2 className="text-5xl font-black">The town votes</h2>
        <p className="text-2xl text-honey">
          {view.votedCount}/{view.totalVoters} voted
        </p>
        <Countdown deadline={view.deadline} />
      </section>
    )
  } else if (view.phase === 'reveal') {
    phase = (
      <section className="space-y-5 text-center">
        <h2 className="text-5xl font-black">
          {view.eliminatedNickname
            ? `${view.eliminatedNickname} was eliminated`
            : 'The vote was tied — no one was eliminated'}
        </h2>
        {view.revealedRole && (
          <p className="text-3xl text-punch">They were {ROLE_LABELS[view.revealedRole]}</p>
        )}
        <ul className="mx-auto max-w-lg space-y-2">
          {view.tally.map((row) => (
            <li key={row.nickname} className="flex justify-between rounded-lg border border-line bg-stage px-5 py-3 text-xl">
              <span>{row.nickname}</span>
              <span>{row.count} votes</span>
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={onAdvance}>
          Nightfall
        </Button>
      </section>
    )
  } else {
    phase = (
      <section className="space-y-6 text-center">
        <h2 className="text-6xl font-black">🏆 {view.winner === 'town' ? 'Town' : 'Mafia'} wins!</h2>
        <ul className="mx-auto grid max-w-2xl gap-2 sm:grid-cols-2">
          {view.allRoles.map((row) => (
            <li key={row.nickname} className="flex justify-between rounded-lg border border-line bg-stage px-4 py-3">
              <span>{row.nickname}</span>
              <span className="font-bold">{ROLE_LABELS[row.role]}</span>
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={onEnd}>
          Back to lobby
        </Button>
      </section>
    )
  }

  return (
    <div className="w-full max-w-6xl space-y-10">
      {phase}
      {playerGrid(view)}
    </div>
  )
}
