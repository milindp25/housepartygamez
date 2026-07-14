'use client'
import type {
  BluffPlayerView,
  GameId,
  GameInputResult,
  ImposterPlayerView,
  MafiaPlayerView,
  MltPlayerView,
  NhiePlayerView,
  WstPlayerView,
  WyrPlayerView,
} from '@hpg/shared'
import { getSocket } from '@/lib/socket'
import { WyrPlay } from './WyrPlay'
import { MltPlay } from './MltPlay'
import { NhiePlay } from './NhiePlay'
import { WstPlay } from './WstPlay'
import { ImposterPlay } from './ImposterPlay'
import { BluffPlay } from './BluffPlay'
import { MafiaPlay } from './MafiaPlay'

/**
 * Routes the personalized player view to the right game's phone renderer.
 *
 * `input` is the single canonical `game:input` emitter shared by every game;
 * each game maps its own player action into the input shape its reducer
 * expects. Adding a new game means adding one `case` and one `Play`
 * component — no other join-page changes.
 */
export function GamePlay({ gameId, view }: { gameId: GameId; view: unknown }) {
  const input = (payload: unknown): Promise<GameInputResult> => {
    const socket = getSocket()
    if (!socket.connected) {
      return Promise.resolve({ ok: false, error: 'Game input connection unavailable' })
    }
    return new Promise((resolve) =>
      socket.timeout(3_000).emit('game:input', { input: payload }, (error, result) =>
        resolve(error ? { ok: false, error: 'Game input acknowledgement timed out' } : result),
      ),
    )
  }
  switch (gameId) {
    case 'would-you-rather':
      return <WyrPlay view={view as WyrPlayerView} onVote={(choice) => input({ choice })} />
    case 'most-likely-to':
      return (
        <MltPlay view={view as MltPlayerView} onVote={(targetId) => input({ targetId })} />
      )
    case 'never-have-i-ever':
      return <NhiePlay view={view as NhiePlayerView} onAnswer={(done) => input({ done })} />
    case 'who-said-that':
      return (
        <WstPlay
          view={view as WstPlayerView}
          onSubmitAnswer={(text) => input({ text })}
          onGuess={(authorId) => input({ authorId })}
        />
      )
    case 'imposter':
      return (
        <ImposterPlay
          view={view as ImposterPlayerView}
          onReady={() => input({ ready: true })}
          onVote={(suspectId) => input({ suspectId })}
        />
      )
    case 'bluff-battle': {
      const bluffView = view as BluffPlayerView
      return (
        <BluffPlay
          key={bluffView.phase === 'finished' ? 'finished' : bluffView.round}
          view={bluffView}
          onSubmitBluff={(text) => input({ text })}
          onPick={(optionId) => input({ optionId })}
        />
      )
    }
    case 'mafia':
      return (
        <MafiaPlay view={view as MafiaPlayerView} onTarget={(targetId) => input({ targetId })} />
      )
    default:
      return <p>Unknown game: {gameId}</p>
  }
}
