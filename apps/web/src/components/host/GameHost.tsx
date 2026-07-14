'use client'
import type { GameId, WyrHostView } from '@hpg/shared'
import { WyrHost } from './WyrHost'

export interface GameHostProps {
  gameId: GameId
  view: unknown
  onAdvance: () => void
  onEnd: () => void
}

/**
 * Routes the personalized host view to the right game's TV renderer.
 *
 * The switch is exhaustive over `GameId` at the type level; each `case`
 * narrows the untyped `view` to its concrete host-view shape. Adding a new
 * game means adding one `case` here plus its `Host` component — no other
 * host-page changes.
 */
export function GameHost({ gameId, view, onAdvance, onEnd }: GameHostProps) {
  switch (gameId) {
    case 'would-you-rather':
      return <WyrHost view={view as WyrHostView} onAdvance={onAdvance} onEnd={onEnd} />
    default:
      return <p>Unknown game: {gameId}</p>
  }
}
