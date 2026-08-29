<p align="center">
  <img src="client/src/assets/hero.png" alt="CoRide Hero" width="720" style="border-radius:16px;"/>
</p>

<h1 align="center">CoRide — Strangers on the same train, now connected.</h1>

<p align="center">
  <em>Turn temporary physical proximity into low-pressure digital social discovery.</em><br/>
  Built for Delhi Metro commuters • 18–30 • campus-first
</p>

<p align="center">
  <a href="https://github.com/ZaidBuilds/CoRide"><img src="https://img.shields.io/badge/status-MVP4%20shipped-10b981?style=for-the-badge" /></a>
  <img src="https://img.shields.io/badge/stack-Vite%20%7C%20Express%20%7C%20Socket.IO-0284c7?style=for-the-badge" />
  <img src="https://img.shields.io/badge/realtime-Socket.IO-6366f1?style=for-the-badge" />
  <img src="https://img.shields.io/badge/license-MIT-475569?style=for-the-badge" />
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-features-mvp1-4">Features</a> •
  <a href="#-api">API</a> •
  <a href="ARCHITECTURE.md">Full Arch →</a>
</p>

---

### The Problem

Millions ride beside strangers for 30-45 minutes daily and never talk. Existing apps need prior relationships, dating framing, or community join before discovery. **CoRide makes the commute the reason to connect — ephemeral, anonymous-enough, accountable.**

> **Jobs:** Show interesting people around me → Make commute fun → Meet someone I'd never approach → Make me open the app again tomorrow.

### One-Line Demo

```
Blue Line · Noida · 9:07 AM — 38 travelers online.
```

Open → auto-detects `Rajiv Chowk (cell tower + GPS + motion + timetable)` → live room → browse → vibe → connect → Metro Friend → persists after commute.

---

## ✨ Features — MVP1 → MVP4

| MVP | Objective | What’s Live |
|---|---|---|
| **1 — Proof of Loop** | Do strangers browse → connect? | Auth + avatar + station/train rooms + traveler list + profile drawer + connect/block/report + 1:1 DM (encrypted emit) |
| **2 — Real-Time Layer** | Feel genuinely live | `live_count_tick 15s` + `heartbeat 25s` + station 45m / train 25m ephemeral TTL + join/leave alerts + typing + commute window push (`07:30-10:30 / 17:00-20:30 IST` + `sw.js`) — **metric: meaningful live sessions / commuter** |
| **3 — Engagement** | Have something to do when chat is awkward | **Word Chain** (15s, 3 lives) + **20 Questions** (bot yes/no) + **Fast Trivia** (5×15s) + **Prompt Wall** (40c, 4m) + **Reactions** `❤️😂🔥👏😮🙏👍☕🎧🚇` + `activityFeed` — `<30s` to learn, `<5m` session, multilingual |
| **4 — Personalization** | Network gets more useful per user | **26 interest tags** `music/coding/books/gaming/cricket/food/...` → **smart ranking** `mutual*15 + trust12/8/4` → **mutual pills** + **People you may vibe with (3)** → **saved commute** one-tap → **Metro Friends** + **persistent DM** → **profile++** (bio/vibe/languages) → **trust badges** `newcomer/regular/trusted/verified` |

**Network effect:** `More users → denser rooms → better ranking → more connections → trust↑ → retention → more users` — measured via `GET /api/analytics/summary → meaningfulPerCommuter`.

---

## 🏗️ Architecture

```mermaid
flowchart TD
  A[React App Vite :5173<br/>Expo Ready] --> B[API Gateway Express :4000]
  A --> C[WebSocket Socket.IO]
  B --> D[Node.js Backend]
  C --> D
  D --> E[(PostgreSQL<br/>store.json MVP → pg)]
  D --> F[(Redis<br/>in-mem → ioredis)]
  D --> G[Transit Context Engine]
  G --> H[Location / Activity Signals]
  G --> I[Transit Network + Timetable]
  D --> J[Push Notification Service]
  D --> K[Moderation / Safety]
  D --> L[Analytics]
```

> Full mapping + prod swap → [`ARCHITECTURE.md`](ARCHITECTURE.md)

**Stack:** TypeScript strict, Vite 5 + React 19, Express 4, Socket.IO 4, `store.json` (MVP) → `Postgres + Drizzle`, in-mem → `Redis`, `PostHog` ready.

---

## 🚀 Quick Start

### 1) Without Docker (MVP)

```bash
git clone https://github.com/ZaidBuilds/CoRide.git
cd CoRide

npm i --prefix server && npm i --prefix client

# env (optional - defaults to blue beachhead, file store)
cp server/.env.example server/.env

# run
npm run dev --prefix server   # :4000
npm run dev --prefix client   # :5173 → open http://localhost:5173
```

### 2) With Docker (prod infra)

```bash
docker compose up -d postgres redis      # only infra
DATABASE_URL=postgres://coride:coride@localhost:5432/coride \
REDIS_URL=redis://localhost:6379 \
npm run dev --prefix server

# OR full stack (nginx serves client)
docker compose up --build
# web http://localhost:5173  api http://localhost:4000  pg :5432  redis :6379
```

### Expo (when ready)

```bash
npx create-expo-app coride-native
# reuse client/src/types.ts + engagement types + useCommuteNotifications (swap Notification → expo-notifications)
```

---

## 🔧 Env

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4000` | API |
| `BEACHHEAD_LINE` | `blue` | `blue / yellow / all` — one corridor to make room feel alive |
| `BEACHHEAD_STATIONS` | *(empty)* | e.g. `rajiv_chowk:botanical_garden` slice |
| `DATABASE_URL` | *(file)* | `postgres://coride:coride@localhost:5432/coride` |
| `REDIS_URL` | *(mem)* | `redis://localhost:6379` |
| `VAPID_PUBLIC_KEY` | | `npx web-push generate-vapid-keys` |

---

## 🔌 API (key)

```
GET  /api/metro/lines              → active lines (beachhead filtered)
GET  /api/metro/beachhead
POST /api/context/detect           → {cellTowerId, lat,lng, movementState, speedKmh, routeHistory, userConfirmed} → {context {confidence, breakdown, trainId}, room}
GET  /api/interests                → 26 tags
GET  /api/profile/:userId          → enriched + trustBadge
PATCH /api/profile/:userId         → {pseudonym,bio,interestTags[≤5],languages,vibeTagline,favoriteStationId}
GET  /api/reputation/:userId       → {tier,badge,score}
GET  /api/rank/:roomId?viewerId=   → ranked[] {score, mutualTags, trustTier}
GET  /api/vibe/:roomId/:viewerId   → vibe[3]
POST /api/commute/patterns         → save {lineId,stationId,direction,targetTime,daysOfWeek,label}
GET  /api/commute/patterns/:userId → list
POST /api/commute/patterns/:userId/:patternId/use → one-tap + room
DELETE /api/commute/patterns/:userId/:patternId

GET  /api/engagement/:roomId       → {activeGame, reactions, leaderboard, activityFeed}
GET  /api/friends/:userId          → friends enriched with trust
GET  /api/dm/:u/:f                 → persistent DM history
GET  /api/commute/windows          → {windows, isLiveNow}
POST /api/push/subscribe           → {userId, subscription}
GET  /api/analytics/summary        → {activatedUsers, travelersSeenAvg, meaningfulLiveSessions, meaningfulPerCommuter, ...}
```

**Sockets:** `join_room, leave_room, heartbeat, send_message, typing_start/stop, connect_request, accept_connection, send_dm, create_game, word_chain_submit, twenty_q_ask/guess, trivia_answer, prompt_submit/rotate, reaction_toggle, fetch_engagement` + pushes `room_updated, live_count_tick, commute_window_live, engagement_updated, reaction_updated`.

---

## 🧠 Personalization in 10s

1. Tap **✎ Edit** in top bar → pick 5 tags `🎵music 💻coding 🏏cricket 🍛food ...` + bio + vibe `Chai + Code`.
2. Re-open station/train → **People you may vibe with** (purple) shows `2 shared: music,coding` before the full list — smart rank `mutual*15 + trust`.
3. **Saved commute** → `＋ Add` → `College commute 08:30` → `Go` next morning one tap → same room, denser.
4. As you connect, `karma 100 → 105 → trusted ⭐` — future ranking ↑, network compounds.

---

## 📊 Product Principles

`Presence before content` · `Context before identity` · `Low friction (auto-detect + manual confirm +50)` · `Anonymous enough, accountable` → `trustTier` · `Ephemeral by default` (45m station / 25m train) · `Safety before growth` (block/report + decay) · `One strong loop` Discovery→Vibe→Connect→Friends→Return.

---

## 🗺️ Roadmap

- [x] MVP1 loop + MVP2 live + MVP3 games + MVP4 personalization
- [ ] Migrate `store.json → Postgres (drizzle)` + `presence → Redis` + `socket.io-redis`
- [ ] Real Web Push VAPID + `expo-notifications`
- [ ] PostGIS route geometry + barometer underground detection
- [ ] On-device ML vibe embedding (beyond tag overlap)

---

## 🤝 Contribute

```bash
npm run build --prefix server && npm run build --prefix client
# add your station to server/src/data/metroData.ts
# add your tag to types.ts INTEREST_TAXONOMY
```

PRs welcome — please keep **surgical changes** and **simplicity first**.

---

## 📄 License

MIT — by **ZaidBuilds** · BCA + solopreneur building in public.

<p align="center">
  <sub>If this made your commute less lonely, ⭐ the repo and hop on Blue Line at 9:07. 38 travelers are waiting.</sub>
</p>
