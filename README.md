# Socket.Kill

A high-performance, real-time EVE Online killmail streaming platform. Socket.Kill ingests killmails from the zKillboard R2 feed and broadcasts them live to connected clients via WebSocket.

## Features

- **Real-time killmail streaming** via WebSocket
- **Region filtering** — filter the live feed by EVE region
- **Whale alerts** — automatic flagging of high-value kills
- **Corp intel webhooks** — Discord notifications for corporation-specific kills
- **Image proxy API** — low-latency ship renders, corporation logos, and market item icons via Cloudflare edge
- **EVE SSO** — player count and server status integration

## Architecture

```
zKillboard R2 Feed → R2 Background Worker → Processor → WebSocket Broadcast
                                                       → Discord Webhooks
                                                       → Stats Manager
```

- **Runtime:** Node.js
- **Transport:** Socket.io (WebSocket + polling fallback)
- **Infrastructure:** DigitalOcean VM + Cloudflare R2 + Cloudflare Edge
- **ESI:** EVE Swagger Interface for character, corporation, and universe data

## API

A public image proxy API is available for EVE Online assets. Free to use for personal and third-party projects. If you integrate this API into your tool or application, a credit link back to [socketkill.com](https://socketkill.com) is appreciated.

Full API documentation is available at [socketkill.com/docs](https://socketkill.com/docs).

## WebSocket Access

A real-time killmail stream is available via WebSocket for approved integrations. Access is whitelist-based. If you would like to connect your application to the live feed, please get in touch to discuss your use case.

## Credits

Built by [@ScottishDex](https://zkillboard.com) • Powered by [zKillboard](https://zkillboard.com) • [socketkill.com](https://socketkill.com)