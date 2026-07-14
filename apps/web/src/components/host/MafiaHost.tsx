'use client'
import type { MafiaHostView, MafiaRole } from '@hpg/shared'
import { Countdown } from '../Countdown'

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
              ? 'border-slate-600 bg-slate-800 text-white'
              : 'border-slate-800 bg-slate-900 text-slate-600 line-through'
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
        <p className="text-xl text-indigo-200">
          {view.actionsDone}/{view.actionsNeeded} night actions complete
        </p>
        <Countdown deadline={view.deadline} />
      </section>
    )
  } else if (view.phase === 'day') {
    phase = (
      <section className="space-y-6 text-center">
        <h2 className="max-w-5xl text-5xl font-black">{dayAnnouncement(view)}</h2>
        <p className="text-2xl text-amber-200">Discuss out loud. Find the Mafia.</p>
        <Countdown deadline={view.deadline} />
        <div>
          <button
            onClick={onAdvance}
            className="rounded-xl bg-amber-500 px-8 py-4 text-xl font-black text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Start the vote
          </button>
        </div>
      </section>
    )
  } else if (view.phase === 'vote') {
    phase = (
      <section className="space-y-5 text-center">
        <h2 className="text-5xl font-black">The town votes</h2>
        <p className="text-2xl text-amber-200">
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
          <p className="text-3xl text-rose-300">They were {ROLE_LABELS[view.revealedRole]}</p>
        )}
        <ul className="mx-auto max-w-lg space-y-2">
          {view.tally.map((row) => (
            <li key={row.nickname} className="flex justify-between rounded-lg bg-slate-800 px-5 py-3 text-xl">
              <span>{row.nickname}</span>
              <span>{row.count} votes</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onAdvance}
          className="rounded-xl bg-indigo-500 px-8 py-4 text-xl font-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Nightfall
        </button>
      </section>
    )
  } else {
    phase = (
      <section className="space-y-6 text-center">
        <h2 className="text-6xl font-black">🏆 {view.winner === 'town' ? 'Town' : 'Mafia'} wins!</h2>
        <ul className="mx-auto grid max-w-2xl gap-2 sm:grid-cols-2">
          {view.allRoles.map((row) => (
            <li key={row.nickname} className="flex justify-between rounded-lg bg-slate-800 px-4 py-3">
              <span>{row.nickname}</span>
              <span className="font-bold">{ROLE_LABELS[row.role]}</span>
            </li>
          ))}
        </ul>
        <button onClick={onEnd} className="rounded-xl bg-emerald-600 px-8 py-4 text-xl font-black">
          Back to lobby
        </button>
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
