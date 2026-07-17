# HousePartyGamez

HousePartyGamez is a pnpm workspace containing the Next.js shared-screen web app, Socket.IO game server, shared engines, and game content.

## Local development

```bash
pnpm install
pnpm dev:server
pnpm dev:web
```

The web app defaults to [http://localhost:3000](http://localhost:3000), and the game server defaults to [http://localhost:4000](http://localhost:4000).

## Production environment

Configure these values in the deployment platforms before launch:

| Service            | Variable                      | Required value                                                 |
| ------------------ | ----------------------------- | -------------------------------------------------------------- |
| Game server        | `NODE_ENV`                    | `production`                                                   |
| Game server        | `CORS_ORIGIN`                 | Exact public web origin, such as `https://housepartygamez.com` |
| Web app            | `NEXT_PUBLIC_GAME_SERVER_URL` | Public HTTPS origin of the deployed game server                |
| Web app            | `NEXT_PUBLIC_SITE_URL`        | Exact public web origin, without a trailing slash              |
| Web app (optional) | `NEXT_PUBLIC_POSTHOG_KEY`     | PostHog project key                                            |
| Web app (optional) | `NEXT_PUBLIC_POSTHOG_HOST`    | PostHog ingest origin                                          |

`CORS_ORIGIN` fails closed in production when omitted. After deployment, verify:

```bash
curl https://<game-server-domain>/health
curl https://<web-domain>/sitemap.xml
curl https://<web-domain>/robots.txt
```

Then host and join one production room from separate devices. Confirm the room code appears, the browser console has no connection errors, the health endpoint reports `{"status":"ok","rooms":N}`, and sitemap/canonical/social URLs use the production domain.
