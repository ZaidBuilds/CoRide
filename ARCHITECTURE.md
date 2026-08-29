# CoRide — Architecture (MVP4)

> `More users → denser rooms → better discovery → more connections → stronger retention → more users`

## System Diagram

```mermaid
flowchart TD
  A[React App — Vite :5173<br/>Expo Ready] --> B[API Gateway — Express CORS :4000]
  A --> C[WebSocket — Socket.IO]
  B --> D[Node.js Backend<br/>server/src/index.ts]
  C --> D
  D --> E[(PostgreSQL<br/>store.json MVP → pg)]
  D --> F[(Redis<br/>in-mem presence + rooms → ioredis)]
  D --> G[Transit Context Engine<br/>transitContextEngine.ts]
  G --> H[Location / Activity Signals<br/>watchPosition + cellTower + speedKmh]
  G --> I[Transit Network + Timetable<br/>DELHI_METRO_LINES + ScheduleEngine]
  D --> J[Push Notification Service<br/>isCommuteWindowNow + /api/push/subscribe + sw.js]
  D --> K[Moderation / Safety Layer<br/>moderationEngine.ts + ConnectionManager]
  D --> L[Analytics<br/>POST /api/analytics/event + summary]

  classDef mvp fill:#0ea5e9,stroke:#0284c7,color:#fff
  classDef prod fill:#10b981,stroke:#059669,color:#fff
  class E,F mvp
```

## MVP4 → Code Mapping (Current)

| Flow Node | Current MVP Implementation | Prod Swap |
|---|---|---|
| **A React** | `client/` Vite React `App.tsx:22` + `Vite :5173` — types shared with RN | `npx create-expo-app` reuse `client/src/types.ts` + `hooks/useCommuteNotifications.ts` |
| **B Gateway** | `server/src/index.ts:22` `express + cors` | Add `helmet`, `rate-limit`, `API Gateway` (Kong/Nginx) |
| **C WS** | `Socket.IO 4` `server/src/index.ts:22` `io` | Same — scale via `socket.io-redis` adapter |
| **D Backend** | `server/src/index.ts` | Same — add `drizzle-orm` layer |
| **E Postgres** | `server/src/services/persistence.ts:4` `store.json` + `commutePatterns` | `DATABASE_URL=postgres://...` + `drizzle.config.ts` |
| **F Redis** | `PresenceManager.ts:1` `Map` + `RoomManager.ts:1` `Map` + `15s live_count_tick` `index.ts:515` | `REDIS_URL=redis://redis:6379` + `ioredis` + `socket.io-redis` |
| **G Engine** | `TransitContextEngine.ts:62` fused `station 30 + route 25 + movement 20 + schedule 20 + confirm 50` + `routeHistory + timeDecay` | Same — add `barometer` pressure sensor later |
| **H Signals** | `App.tsx:206` `watchPosition` + `cellTowerId` + `speedKmh` + `routeHistory` | Same + `ActivityRecognition` native |
| **I Network** | `metroData.ts:1` `DELHI_METRO_LINES` + `ScheduleEngine.ts:16` `peak4/off6` | Same — load from `PostGIS` |
| **J Push** | `isCommuteWindowNow() 07:30-10:30/17:00-20:30 IST` `index.ts:40` + `POST /api/push/subscribe` + `client/public/sw.js` + `useCommuteNotifications.ts` | Add `web-push` VAPID + `J` worker |
| **K Moderation** | `moderationEngine.ts:1` `rateLimit + spam(url/dup/len) + reputation 100 + trustTier` + `ConnectionManager block` | Same — add `perspective API` |
| **L Analytics** | `POST /api/analytics/event` `analytics.log` + `GET /api/analytics/summary` `meaningfulPerCommuter` | `ClickHouse / PostHog` |

## Personalization (MVP4) Detail

- **Taxonomy** `server/src/types.ts:14` + `client/src/types.ts:13` 26 tags `music/coding/books/gaming/cricket/food/...` — `sanitizeTags() max5`.
- **Ranking** `personalization/rankingService.ts:1` `mutual*15 + college10 + presence10/5 + trust12/8/4 + karma/20 + recency2` → `GET /api/rank/:roomId?viewerId` + `GET /api/vibe/:roomId/:viewerId`.
- **Mutual UI** `TravelerCard.tsx:11` + `DiscoveryScreen.tsx:8` purple border + `Sparkles N shared` + vibe strip.
- **Saved Commute** `personalization/commutePatternService.ts:1` `Persistence.commutePatterns` → `POST/GET/DELETE /api/commute/patterns` + `POST .../use` one-tap → `roomManager.getOrCreateFromContext()` → `client/SavedCommutes.tsx:1`.
- **Profile++** `PATCH /api/profile/:userId` → `ProfileEditor.tsx:1`.
- **Trust** `moderationEngine.ts:40` `newcomer/regular/trusted/verified` → badge in `TravelerCard`/`ProfileDrawer`/`FriendsTab`.
- **DM** `Persistence.directMessages` + `emitToUsers()` + `GET /api/dm/:u/:f` — persists after commute.

## Network Effect Loop (Measurable)

```
connectedCount ↑ → ranked mutual ↑ → vibe 3 ↑ → connect click ↑ → moderation.recordPositive(5) → trustTier ↑ → future rank ↑ → room userCount ↑ → live_count_tick 15s → meaningfulLiveSession → analytics summary → retention
```

Query `GET /api/analytics/summary` → `meaningfulPerCommuter = meaningfulLiveSessions / activatedUsers`.

## Env

See `server/.env.example` — `BEACHHEAD_LINE`, `DATABASE_URL`, `REDIS_URL`, `VAPID_*`, `PORT`.

## Run

```bash
# MVP (no docker)
npm run dev --prefix server
npm run dev --prefix client

# Prod infra (pg+redis)
docker compose up -d postgres redis
DATABASE_URL=postgres://coride:coride@localhost:5432/coride REDIS_URL=redis://localhost:6379 npm run dev --prefix server

# Full stack
docker compose up --build
# web http://localhost:5173  api http://localhost:4000  pg :5432  redis :6379
```

## Expo Migration (When Ready)

1. `npx create-expo-app coride-native`
2. Copy `client/src/types.ts`, `client/src/types/engagement.ts`, `client/src/utils/analytics.ts`, `client/src/hooks/useCommuteNotifications.ts` (replace Notification with `expo-notifications`).
3. Reuse `server/src/data/metroData.ts` as shared package.
