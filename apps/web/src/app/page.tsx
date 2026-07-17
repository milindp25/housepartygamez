import type { CSSProperties } from 'react'
import Link from 'next/link'
import { MARKETING_GAMES } from '@/lib/games'
import { homeJsonLd } from '@/lib/seo'

const roomCode = ['P', 'A', 'R', 'T', 'Y', '!'] as const

const roomSteps = [
  {
    title: 'Put the room on the big screen',
    copy: 'Open a room as host and keep the shared game board where everyone can see it.',
  },
  {
    title: 'Share one short code',
    copy: 'Friends open the join page, enter the room code, and pick a name. No account needed.',
  },
  {
    title: 'Play from every phone',
    copy: 'Prompts stay on the shared screen while private votes, clues, and bluffs stay in each hand.',
  },
] as const

/** Render the public HousePartyGamez landing page. */
export default function Home() {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(homeJsonLd())}</script>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header marketing-shell">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true">
            HP
          </span>
          <span>HousePartyGamez</span>
        </div>
        <p>Seven games · one room</p>
      </header>

      <main id="main-content">
        <section className="hero marketing-shell" aria-labelledby="hero-title">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">The shared-screen party starter</p>
              <h1 id="hero-title">Party games everyone plays on their phones</h1>
              <p className="hero-lede">
                Put one game on the TV, share a room code, and turn every phone into a private
                controller. No app download and no pile of cards to explain.
              </p>
              <div className="button-row">
                <Link className="button button-primary" href="/host">
                  Host a game
                </Link>
                <Link className="button button-secondary" href="/join">
                  Join a room
                </Link>
              </div>
            </div>

            <div className="marquee-stage">
              <p className="marquee-label">Tonight&apos;s room code</p>
              <p className="sr-only">Example room code: PARTY!</p>
              <div className="room-code-marquee" aria-hidden="true">
                {roomCode.map((character, index) => (
                  <span key={`${character}-${index}`}>{character}</span>
                ))}
              </div>
              <p className="marquee-note">One code gets the whole room in.</p>
            </div>
          </div>
        </section>

        <section className="process-section marketing-shell" aria-labelledby="process-title">
          <div className="section-heading">
            <p className="eyebrow">How the room works</p>
            <h2 id="process-title">From sofa to showdown in three moves</h2>
          </div>
          <ol className="process-list">
            {roomSteps.map((step, index) => (
              <li key={step.title}>
                <span className="step-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="games-section marketing-shell" id="games" aria-labelledby="games-title">
          <div className="section-heading section-heading-wide">
            <div>
              <p className="eyebrow">Pick the room&apos;s energy</p>
              <h2 id="games-title">Seven ways to start something</h2>
            </div>
            <p>Quick votes, hidden roles, suspicious clues, and excellent lies—all ready now.</p>
          </div>

          <div className="game-grid">
            {MARKETING_GAMES.map((game, index) => (
              <article
                className="game-card"
                key={game.id}
                style={{ '--game-accent': game.accent } as CSSProperties}
              >
                <div className="game-card-topline">
                  <span>Game {String(index + 1).padStart(2, '0')}</span>
                  <span>{game.minPlayers}–{game.maxPlayers} players · {game.minutes} min</span>
                </div>
                <h3>
                  <Link
                    href={`/games/${game.slug}`}
                    aria-label={`${game.name}: ${game.tagline}`}
                  >
                    {game.name}
                  </Link>
                </h3>
                <p>{game.tagline}</p>
                <span className="card-arrow" aria-hidden="true">
                  ↗
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="closing-section marketing-shell" aria-labelledby="closing-title">
          <div>
            <p className="eyebrow">House lights are up</p>
            <h2 id="closing-title">Your next inside joke starts here.</h2>
          </div>
          <div className="button-row">
            <Link className="button button-primary" href="/host">
              Host a game
            </Link>
            <Link className="button button-secondary" href="/join">
              Join a room
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer marketing-shell">
        <p>HousePartyGamez</p>
        <p>One shared screen. Every phone in the game.</p>
      </footer>
    </>
  )
}
