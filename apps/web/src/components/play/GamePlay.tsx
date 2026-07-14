'use client'
import type { GameId, WyrPlayerView } from '@hpg/shared'
import { getSocket } from '@/lib/socket'
import { WyrPlay } from './WyrPlay'

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
    default:
      return <p>Unknown game: {gameId}</p>
  }
}
