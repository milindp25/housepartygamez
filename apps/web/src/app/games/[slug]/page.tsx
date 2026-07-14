import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MARKETING_GAMES, getMarketingGame } from '@/lib/games'

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

/** Pre-render every implemented game detail page. */
export function generateStaticParams(): Array<{ slug: string }> {
  return MARKETING_GAMES.map(({ slug }) => ({ slug }))
}

/** Generate per-game search metadata from the public registry. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = getMarketingGame((await params).slug)
  if (!game) return { title: 'Game not found' }
  return { title: `Play ${game.name} Online with Friends`, description: game.description }
}

/** Render one statically generated public game guide. */
export default async function GamePage({ params }: Props) {
  const game = getMarketingGame((await params).slug)
  if (!game) notFound()

  return (
    <div className="detail-page" style={{ '--game-accent': game.accent } as CSSProperties}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header marketing-shell">
        <Link className="wordmark" href="/" aria-label="HousePartyGamez home">
          <span className="wordmark-mark" aria-hidden="true">
            HP
          </span>
          <span>HousePartyGamez</span>
        </Link>
        <p>{game.minPlayers}–{game.maxPlayers} players</p>
      </header>

      <main id="main-content" className="detail-main marketing-shell">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/#games">All games</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{game.name}</span>
        </nav>

        <article className="detail-article">
          <header className="detail-hero">
            <div>
              <p className="eyebrow">Ready in about {game.minutes} minutes</p>
              <h1>{game.name}</h1>
              <p className="detail-tagline">{game.tagline}</p>
            </div>
            <dl className="detail-facts">
              <div>
                <dt>Players</dt>
                <dd>{game.minPlayers}–{game.maxPlayers}</dd>
              </div>
              <div>
                <dt>Play time</dt>
                <dd>{game.minutes} min</dd>
              </div>
            </dl>
          </header>

          <div className="detail-body">
            <section className="detail-description" aria-labelledby="about-title">
              <p className="eyebrow">About the game</p>
              <h2 id="about-title">Make the room part of the story</h2>
              <p>{game.description}</p>
            </section>

            <section className="detail-steps" aria-labelledby="steps-title">
              <p className="eyebrow">How to play</p>
              <h2 id="steps-title">Four moves, then the room takes over</h2>
              <ol>
                {game.howTo.map((step, index) => (
                  <li key={step}>
                    <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </article>

        <section className="detail-cta" aria-labelledby="detail-cta-title">
          <div>
            <p className="eyebrow">Bring everyone in</p>
            <h2 id="detail-cta-title">Put {game.name} on the big screen.</h2>
          </div>
          <div className="button-row">
            <Link className="button button-primary" href="/host">
              Host {game.name}
            </Link>
            <Link className="button button-secondary" href="/#games">
              All games
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer marketing-shell">
        <p>HousePartyGamez</p>
        <p>One shared screen. Every phone in the game.</p>
      </footer>
    </div>
  )
}
