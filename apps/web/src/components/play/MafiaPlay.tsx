'use client'
import type { MafiaPlayerView, MafiaRole } from '@hpg/shared'
import { Countdown } from '../Countdown'

const ROLE_LABELS: Record<MafiaRole, string> = {
  mafia: '🔪 MAFIA',
  detective: '🕵️ DETECTIVE',
  doctor: '💉 DOCTOR',
  civilian: '👤 CIVILIAN',
}

const ROLE_STYLES: Record<MafiaRole, string> = {
  mafia: 'border-rose-500/60 bg-rose-950/80 text-rose-100',
  detective: 'border-sky-500/60 bg-sky-950/80 text-sky-100',
  doctor: 'border-emerald-500/60 bg-emerald-950/80 text-emerald-100',
  civilian: 'border-slate-500/60 bg-slate-800/80 text-slate-100',
}

function announcement(view: Extract<MafiaPlayerView, { phase: 'day' }>): string {
  if (view.lastNight.saved) return 'The Doctor saved someone last night!'
  if (view.lastNight.killedNickname) {
    return `☀️ ${view.lastNight.killedNickname} was found eliminated`
  }
  return '☀️ No one was eliminated last night'
}

function roleName(role: MafiaRole): string {
  return role.toUpperCase()
}

/** Phone rendering for Mafia with only callback-driven player actions. */
export function MafiaPlay({
  view,
  onTarget,
}: {
  view: MafiaPlayerView
  onTarget: (targetId: string) => void
}) {
  const roleBanner = (
    <section className={`rounded-2xl border p-4 text-center ${ROLE_STYLES[view.role]}`}>
      <p className="text-lg font-black tracking-wide">
        You are the {ROLE_LABELS[view.role]}
        {view.role === 'mafia' ? ` — team: ${view.mafiaTeam?.join(', ') ?? ''}` : ''}
      </p>
    </section>
  )
  const detectiveLog = view.detectiveLog ? (
    <section className="rounded-2xl bg-slate-900 p-4">
      <h2 className="mb-2 font-bold text-sky-300">Detective log</h2>
      {view.detectiveLog.length === 0 ? (
        <p className="text-sm text-slate-500">No investigations yet.</p>
      ) : (
        <ul className="space-y-2">
          {view.detectiveLog.map((entry, index) => (
            <li key={`${entry.targetNickname}-${index}`} className="rounded-lg bg-slate-800 px-3 py-2">
              {entry.targetNickname}: {entry.isMafia ? 'MAFIA' : 'NOT MAFIA'}
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null
  const spectatorBanner = !view.isAlive ? (
    <p className="rounded-2xl border border-slate-600 bg-slate-900 p-4 text-center font-bold text-slate-300">
      💀 You&apos;re out — no spoilers on your face, please
    </p>
  ) : null

  let phase: React.ReactNode
  if (view.phase === 'night') {
    const instruction =
      view.action === 'kill'
        ? 'Choose who to eliminate'
        : view.action === 'save'
          ? 'Choose who to save'
          : view.action === 'investigate'
            ? 'Choose who to investigate'
            : null
    phase = instruction ? (
      <section className="space-y-4 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Night {view.day}</p>
          <h2 className="mt-2 text-2xl font-bold">{instruction}</h2>
          <Countdown deadline={view.deadline} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {view.candidates.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => onTarget(candidate.id)}
              className={`rounded-2xl bg-slate-800 p-4 text-lg font-semibold transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                view.yourTarget === candidate.id ? 'ring-4 ring-indigo-400' : ''
              }`}
            >
              {candidate.nickname}
            </button>
          ))}
        </div>
      </section>
    ) : (
      <section className="space-y-3 rounded-2xl bg-indigo-950/60 p-8 text-center">
        <p className="text-3xl">😴 The town sleeps…</p>
        <Countdown deadline={view.deadline} />
      </section>
    )
  } else if (view.phase === 'day') {
    phase = (
      <section className="space-y-5 text-center">
        <p className="text-2xl font-black">{announcement(view)}</p>
        <p className="text-lg text-amber-200">Discuss out loud. Who seems suspicious?</p>
        <Countdown deadline={view.deadline} />
      </section>
    )
  } else if (view.phase === 'vote') {
    phase = (
      <section className="space-y-4 text-center">
        <h2 className="text-2xl font-black">Vote to eliminate</h2>
        <Countdown deadline={view.deadline} />
        {view.candidates.length === 0 ? (
          <p className="text-slate-400">Watch the town decide.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {view.candidates.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => onTarget(candidate.id)}
                className={`rounded-2xl bg-slate-800 p-4 text-lg font-semibold transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  view.yourVote === candidate.id ? 'ring-4 ring-amber-400' : ''
                }`}
              >
                {candidate.nickname}
              </button>
            ))}
          </div>
        )}
      </section>
    )
  } else if (view.phase === 'reveal') {
    phase = (
      <section className="space-y-4 text-center">
        <h2 className="text-3xl font-black">
          {view.eliminatedNickname
            ? `${view.eliminatedNickname} was eliminated`
            : 'The vote was tied — no one was eliminated'}
        </h2>
        {view.revealedRole && (
          <p className="text-xl text-rose-300">They were {roleName(view.revealedRole)}</p>
        )}
        <ul className="mx-auto max-w-sm space-y-2">
          {view.tally.map((row) => (
            <li key={row.nickname} className="flex justify-between rounded-lg bg-slate-800 px-4 py-2">
              <span>{row.nickname}</span>
              <span>{row.count} votes</span>
            </li>
          ))}
        </ul>
      </section>
    )
  } else {
    phase = (
      <section className="space-y-5 text-center">
        <h2 className="text-4xl font-black">🏆 {view.winner === 'town' ? 'Town' : 'Mafia'} wins!</h2>
        <ul className="mx-auto max-w-md space-y-2">
          {view.allRoles.map((row) => (
            <li key={row.nickname} className="flex justify-between rounded-lg bg-slate-800 px-4 py-3">
              <span>{row.nickname}</span>
              <span className="font-bold">{ROLE_LABELS[row.role]}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {roleBanner}
      {detectiveLog}
      {spectatorBanner}
      {phase}
    </div>
  )
}
