'use client'
import type {
  BluffHostView,
  GameId,
  ImposterHostView,
  MafiaHostView,
  MltHostView,
  NhieHostView,
  WstHostView,
  WyrHostView,
} from '@hpg/shared'
import { WyrHost } from './WyrHost'
import { MltHost } from './MltHost'
import { NhieHost } from './NhieHost'
import { WstHost } from './WstHost'
import { ImposterHost } from './ImposterHost'
import { BluffHost } from './BluffHost'
import { MafiaHost } from './MafiaHost'

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
    case 'most-likely-to':
      return <MltHost view={view as MltHostView} onAdvance={onAdvance} onEnd={onEnd} />
    case 'never-have-i-ever':
      return <NhieHost view={view as NhieHostView} onAdvance={onAdvance} onEnd={onEnd} />
    case 'who-said-that':
      return <WstHost view={view as WstHostView} onAdvance={onAdvance} onEnd={onEnd} />
    case 'imposter':
      return (
        <ImposterHost view={view as ImposterHostView} onAdvance={onAdvance} onEnd={onEnd} />
      )
    case 'bluff-battle':
      return <BluffHost view={view as BluffHostView} onAdvance={onAdvance} onEnd={onEnd} />
    case 'mafia':
      return <MafiaHost view={view as MafiaHostView} onAdvance={onAdvance} onEnd={onEnd} />
    default:
      return <p>Unknown game: {gameId}</p>
  }
}
