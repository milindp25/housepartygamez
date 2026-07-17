import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo'

/** Alt text applied to the generated social card. */
export const alt = 'HousePartyGamez — Party games everyone plays on their phones'

/** Standard Open Graph card dimensions. */
export const size = { width: 1200, height: 630 }

/** Emitted content type for the generated image. */
export const contentType = 'image/png'

/** Render the default warm-plum social share card. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1C1420 0%, #2A1F2B 100%)',
          color: '#FDF4EC',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 34,
            letterSpacing: 6,
            color: '#FBBF24',
            textTransform: 'uppercase',
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>
          {SITE_TAGLINE}
        </div>
        <div style={{ fontSize: 32, color: '#C4B3BC', marginTop: 32 }}>
          One shared screen. Every phone in the game.
        </div>
      </div>
    ),
    size,
  )
}
