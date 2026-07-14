'use client'
import type {
  GameId,
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

/**
 * Routes the personalized player view to the right game's phone renderer.
 *
 * `input` is the single canonical `game:input` emitter shared by every game;
 * each game maps its own player action into the input shape its reducer
 * expects. Adding a new game means adding one `case` and one `Play`
 * component — no other join-page changes.
 */
export function GamePlay({ gameId, view }: { gameId: GameId; view: unknown }) {
  const input = (payload: unknown) => getSocket().emit('game:input', { input: payload }, () => {})
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
    default:
      return <p>Unknown game: {gameId}</p>
  }
}
