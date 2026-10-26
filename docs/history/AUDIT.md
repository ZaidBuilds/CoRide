# CoRide Backend Audit

Audit only — no code changed. `file:line` points at the current tree.

## Severity ranking (fix top-down)

| # | Sev | Finding | §  |
|---|-----|---------|----|
| 1 | **Critical** | `send_message` → `addMessage` throws on stale room, unguarded → **whole server crashes** for all users (the recurring crash) | 6 |
| 2 | **Critical** | `GET /api/dm/:userId/:friendId` — **no auth**, reads any pair's DMs; ids harvestable from room list | 4 |
| 3 | **High** | Self-accept consent bypass — sender can accept own request, become a friend without consent | 3 |
| 4 | **High** | socket `fetch_dm_history` — no auth, same DM disclosure | 4 |
| 5 | **High** | No global `uncaughtException` guard — any stray throw is fatal | 6 |
| 6 | **High** | Synchronous full-store disk I/O per request; room GET is O(travelers) reads — event loop saturates ~1k concurrent | 5 |
| 7 | **High** | Heartbeat/leave accept any `userId` — evict or impersonate anyone | 1 |
| 8 | **Med** | Spoofable `x-user-id` is the only identity (no session/token) | 4 |
| 9 | **Med** | 30-min TTL vs 15s heartbeat → up to 30 min ghost presence | 1 |
| 10 | **Med** | No roomId validation → arbitrary room/key creation; presence effectively public | 2 |
| 11 | **Med** | `acceptRequest` ignores status → declined requests can be revived | 3 |
| 12 | **Low** | Empty room set keys never expire; unbounded request history; heartbeat doubles traffic; polls don't back off when hidden; dead `blocked` status; composite-key ambiguity; leftover Hindi in engagement content | 1,2,3,5,7 |

**Launch blockers:** #1 and #2 (both Critical), plus #3 (consent) and #6
(scaling). Everything routes through a spoofable header (#8) — real auth is the
umbrella fix for #2, #4, #7, #8.

---

## 1. Presence — TTL, heartbeat, stale keys, Redis restart

**How it works:** membership in a Redis set `room:{roomId}`; a per-user key
`presence:{roomId}:{userId}` carries a 30-min TTL (`redisPresence.ts:15`).
`heartbeat()` just re-runs `joinRoom()` (`redisPresence.ts:86`), refreshing the
TTL. Client polls + heartbeats every 15s (`RoomScreen.tsx`, `POLL_INTERVAL_MS`).
`getRoom()` prunes members whose TTL key expired (`redisPresence.ts:104`).

| Sev | Finding | Fix | Location |
|-----|---------|-----|----------|
| **High** | **Heartbeat/leave accept any `userId` from the body with no auth.** Anyone can `POST /api/room/:id/leave {userId:X}` to evict X, or heartbeat as X to fake presence. | Require `x-user-id` and use it as the actor; ignore body `userId`. | `index.ts` `/api/room/:roomId/heartbeat`, `/leave` |
| **Med** | **30-min TTL vs 15s heartbeat = up to 30 min of ghost presence.** A user who closes the tab/crashes (so `sendLeave` never fires) still shows "live" for 30 min. Count overstates reality. | Drop TTL to ~45–60s (≈3× the poll) so abandonment clears fast. | `redisPresence.ts:15` |
| **Low** | **Empty `room:{id}` set keys never expire.** When the last member is pruned, the set key lingers forever (0 members). Slow unbounded key growth as rooms churn. | `del` the set key when `getRoom` prunes it to empty, or TTL the set too. | `redisPresence.ts:104` |
| **Low** | **`getRoom` is not atomic** (smembers → mget → srem). A join landing between smembers and mget is missed until the next poll. | Acceptable at 15s cadence; if it matters, use a Lua script. | `redisPresence.ts:94-106` |

**Redis restart mid-session:** ioredis is configured `maxRetriesPerRequest:1,
enableOfflineQueue:false` (`redisPresence.ts:44`), so during downtime
join/heartbeat/getRoom reject in ms and every room route returns **503, no
crash** (`index.ts` room handlers have try/catch). On recovery: if Redis had AOF
(`docker-compose.yml` sets `--appendonly yes`) keys + TTLs survive; if the
active Redis has no persistence, all presence is lost but **self-heals within
~15s** as active clients heartbeat again. Abandoned users simply never come back
— which is the correct outcome. Net: restart is handled gracefully. **Caveat:**
the currently-running instance is another project's container
(`trafficai-redis-1`), whose persistence config is unknown.

---

## 2. Room ids — collision & injection

Format `{station}:{line}:{direction}`, lowercased/trimmed (`redisPresence.ts:24`).
Used raw as Redis keys `room:{roomId}` and `presence:{roomId}:{userId}`
(`redisPresence.ts:28-29`). The room routes take `:roomId` straight from the URL
with **no validation** anywhere (`index.ts` room handlers).

| Sev | Finding | Fix | Location |
|-----|---------|-----|----------|
| **Med** | **No validation that roomId is a real station:line:direction.** Any string creates a room → unbounded key creation (spam/DoS of Redis memory) and silent fragmentation if any caller ever passes a display name ("Rajiv Chowk (Connaught Place)") instead of the id ("rajiv_chowk"). | Validate roomId against the known station/line/direction set before touching Redis; 400 otherwise. | `index.ts` `/api/room/:roomId*` |
| **Med** | **Presence is effectively public.** `GET /api/room/:roomId` needs no auth (viewer only affects block-filtering), and the id space is small and fully guessable (all stations × lines × 2 directions). Anyone can enumerate who is in any coach-direction. | Require auth to read a room; consider not returning full profiles to non-members. | `index.ts` `/api/room/:roomId` |
| **Low** | **Composite-key ambiguity.** `presence:{roomId}:{userId}` — if a `userId` ever contained `:` (or roomId had a non-3-segment shape), `presence:a:b:c` is reachable from two different (roomId,userId) pairs, colliding TTL keys. userIds are currently `usr_*`/`seed_*` (no colons), so latent, not live. | Use a delimiter that can't occur in ids, or length-prefix/hash the parts. | `redisPresence.ts:29` |

**Injection:** no command-injection risk — ioredis passes roomId as an argument,
never as a command, and there is no `eval`/`KEYS`/dynamic command built from it.
Rendered client-side inside `<code>{activeRoomId}</code>` (`RoomScreen.tsx`), which
React escapes, so no XSS. The real exposure is key-space abuse (above), not
injection.

---

## 3. Connection state machine

States: `pending | accepted | declined | blocked` (`connectionManager.ts:4`).
Reachable transitions:
- `sendRequest` → **pending** (or auto-**accepted** if a reciprocal pending exists; or refused if blocked/already-friends/duplicate) `:109-153`
- `acceptRequest` pending → **accepted** (+mutual friendship) `:155-172`
- `declineRequest` pending → **declined** (recipient only) `:175-184`
- `blockUser` any → **declined** + friendship removed + pending cancelled `:236-256`

**No deadlock exists** — every state has an exit. After `declined`, the dup-check
only inspects *pending* requests (`:126-137`), so a fresh request can be sent
again; `accepted` returns "already connected"; `blocked` clears on unblock. A
pair can always progress.

| Sev | Finding | Fix | Location |
|-----|---------|-----|----------|
| **High** | **Self-accept consent bypass.** `acceptRequest` authorizes the **sender** too (`fromUserId !== acceptingUserId` in the guard). `POST /api/connections/:id/accept` sets actor = caller with no "actor ≠ sender" check, so A can `send` then `accept` their own request and become B's friend **without B agreeing** — gaining friends-only chat access. | Guard `req.toUserId === acceptingUserId` only. | `connectionManager.ts:161` |
| **Med** | **`acceptRequest` ignores current status.** Holding a request id, either party can accept a *declined* request and revive the friendship (declined → accepted). | Reject unless `req.status === 'pending'`. | `connectionManager.ts:159-165` |
| **Low** | **`blocked` status is dead.** The enum has it but `blockUser` writes `declined` (`:250`); nothing ever sets/reads `blocked`. Blocks live only in the separate `blocks` set. | Drop the enum value or use it, so status reflects reality. | `connectionManager.ts:4,250` |
| **Low** | **Unbounded request history.** `requests` Map keeps every declined/old record forever; no pruning. Slow memory growth. | Periodically prune resolved requests older than N days. | `connectionManager.ts` (`requests`) |

---

## 4. Chat — auth on every read/write path

Threads are stored under `directMessages[[a,b].sort().join('::')]`. Four access
paths exist:

| Path | Auth check | Verdict |
|------|-----------|---------|
| `GET /api/chats/:id/messages` | `areFriends(me, peerId)` → 403 | ✅ protected |
| `POST /api/chats/:id/messages` | `areFriends(me, peerId)` → 403 + `moderation.preCheck` | ✅ protected |
| `GET /api/chats` | actor = `x-user-id`, only own friends | ✅ (spoofable id, see below) |
| **`GET /api/dm/:userId/:friendId`** | **none** | ❌ **open** |
| **socket `fetch_dm_history`** | **none** | ❌ **open** |

**Can a non-friend read a thread by guessing an id? YES.**

| Sev | Finding | Fix | Location |
|-----|---------|-----|----------|
| **Critical** | **`GET /api/dm/:userId/:friendId` has no auth.** It reads any pair's last 50 messages straight from the store. Both ids are harvestable — `GET /api/room/:id` returns every `traveler.id` — so an attacker lists a room, picks any two ids, and reads their private thread. The new guarded `/api/chats` route is bypassed entirely by this legacy one. | Require `x-user-id`, and only serve threads where the caller is a participant. | `index.ts` `/api/dm/:userId/:friendId` |
| **High** | **socket `fetch_dm_history` has no auth** — same disclosure over the socket; emits any (userId,friendId) thread to whoever asks. | Verify the socket's identity is a participant before emitting. | `index.ts` `fetch_dm_history` handler |
| **Med** | **All identity is a spoofable `x-user-id` header** (also true for connections/blocks/reports). Any "protected" route is only as strong as this header; there is no session/token. | Introduce real auth (signed token) before launch; treat every `x-user-id` route as unauthenticated until then. | all REST routes using `actorId()` |

---

## 5. Polling load

**Per active user, per hour:**
- Room open: `GET /api/room` every 15s **+** heartbeat POST every 15s = **480 req/hr** (240 + 240) — `RoomScreen.tsx` poll loop.
- Chat open: `GET /api/chats/:id/messages` every 5s = **720 req/hr** — `useChatMessages.ts` (`POLL_MS`).

**Nominal request rate by concurrency:**

| Concurrent | Room (480/hr) | Chat (720/hr) |
|-----------|---------------|----------------|
| 100 | 13 req/s | 20 req/s |
| 1,000 | 133 req/s | 200 req/s |
| 10,000 | 1,333 req/s | 2,000 req/s |

| Sev | Finding | Fix | Location |
|-----|---------|-----|----------|
| **High** | **Every request does synchronous full-store disk I/O.** `persistence.load()` = `fs.readFileSync` + `JSON.parse` of the entire `store.json` on each call, blocking the single event loop. `persistence.save()` rewrites the whole pretty-printed store synchronously on every chat send. | Hold the store in memory; persist async/debounced. | `persistence.ts` `load()`/`save()` |
| **High** | **Room GET is O(travelers) full-store reads.** It calls `persistence.getProfile(id)` first for every traveler (`index.ts` room handler), and `getProfile` calls `load()` each time (`persistence.ts:getProfile`). A 20-traveler room = 20 full readFileSync+parse per poll, ×N users ×(poll/15s). The in-memory `roomManager.getUserProfile` is only the fallback. | Look up the in-memory map first (or cache the store); never disk-read per traveler. | `index.ts` room handler; `persistence.ts:getProfile` |
| **Med** | **Heartbeat doubles room traffic.** Presence heartbeat is a separate POST each poll; it could piggyback on the GET. | Fold heartbeat into the room GET (server refreshes TTL on read). | `RoomScreen.tsx`, `index.ts` room routes |
| **Low** | **Polls never back off when hidden.** Tabs in the background keep polling at full rate. | Pause/relax polling on `visibilitychange`. | `RoomScreen.tsx`, `useChatMessages.ts` |

**Bottom line:** the nominal req/s above is **not** the real ceiling — the
synchronous per-request disk I/O saturates the event loop far earlier (likely
low-hundreds of req/s, i.e. around the 1k-concurrent mark), well before raw
network limits. Fix persistence before load-testing.

---

## 6. Error paths — crash vs 5xx

Socket.IO does **not** catch synchronous throws in event handlers, and there is
**no global `process.on('uncaughtException')`** guard anywhere in `index.ts`. So
any unguarded throw inside a handler exits the whole process.

| Sev | Finding | Fix | Location |
|-----|---------|-----|----------|
| **Critical** | **`send_message` crashes the entire server.** The handler calls `roomManager.addMessage`, which `throw`s `'Room not found'` for any unknown/expired roomId, and the handler has **no try/catch**. One client emitting to a stale room takes down every connected user. This is the crash seen repeatedly this session. | Wrap the handler in try/catch → `error_message` (as `join_room` already does), and/or make `addMessage` return null. | `index.ts` `send_message` (~:761); throw at `roomManager.ts:308` |
| **High** | **No global exception guard.** Any stray throw (in a socket handler, a `.then` without catch, a bad payload) is fatal. | Add `process.on('uncaughtException')` + `unhandledRejection` logging that keeps the process alive; add a Socket.IO handler wrapper. | `index.ts` (startup) |
| **Low** | **REST connection/report/block routes have no try/catch.** They currently call non-throwing manager methods, so they return 200/4xx today — but they're one refactor away from a 500-or-crash. | Wrap in try/catch → 500, or a global Express error middleware. | `index.ts` `/api/connections*`, `/api/reports`, `/api/blocks*` |

**Safe (return 5xx, no crash):** all `/api/room*` routes and
`POST /api/chats/:id/messages` have try/catch → 503/500. `join_room` is guarded
(→ `error_message`). `persistence.load/save` swallow their own errors.

---

## 7. Remaining Hindi strings

Devanagari (`[\u0900-\u097F]`) still present in 5 files (ripgrep's `\p` missed
these on this Windows build; found via a unicode scan):

| Sev | File | Lines | What |
|-----|------|-------|------|
| **Low** | `server/src/data/metroData.ts` | 25 | `hindiName` per station — bilingual data, likely intentional |
| **Low** | `server/src/services/engagement/promptsData.ts` | 12 | Hindi prompt text |
| **Low** | `server/src/services/engagement/triviaData.ts` | 4 | Hindi trivia text |
| **Low** | `client/src/components/engagement/EngagementHub.tsx` | 4 | `hindi:` game labels |
| **Low** | `client/src/components/engagement/PromptWall.tsx` | 1 | Hindi string |

None are bugs. `metroData.hindiName` is deliberate bilingual data. The engagement
Hindi is content, not UI chrome — decide whether it's intended localization or
leftover. **One-line fix (if unwanted):** delete the `hindi`/Hindi fields in the
four engagement files; keep `hindiName` in `metroData.ts`.

---

## Fixes applied

| # | Finding | Status | Verified |
|---|---------|--------|----------|
| 1 | `send_message` crash | ✅ fixed — try/catch + graceful `error_message` | socket emit to bad room → `error_message`, server stays 200, 0 crashes |
| 2 | `/api/dm` no auth | ✅ fixed — requires participant `x-user-id` | 401 no header / 403 non-participant / 200 participant |
| 3 | Self-accept consent bypass | ✅ fixed — recipient-only accept | sender→403, recipient→200; reciprocal auto-accept still works |
| 4 | `fetch_dm_history` no auth | ✅ fixed — socket must own the claimed userId | code guard via `userIdToSocketIds` |
| 5 | No global exception guard | ✅ fixed — `uncaughtException`/`unhandledRejection` | present at startup |
| 6 | Sync full-store disk I/O | ✅ fixed — in-memory cache + debounced async write; `getProfile` now O(1) | build green |
| 7 | Heartbeat/leave trust body userId | ✅ fixed — `x-user-id` only; client updated | heartbeat no header → 401 |
| 9 | 30-min ghost presence | ✅ fixed — TTL 60s (env-tunable); seeds keep 24h | roomId validation path 503 (redis down at test) |
| 10 | No roomId validation | ✅ fixed — `station:line:direction` slug regex on all room routes | `foo`→400, `a:b:c`→passes |
| 11 | Accept ignores status | ✅ fixed — pending-only | re-accept resolved → 403 |
| 8 | Spoofable `x-user-id` | ⏸ deferred — needs real token auth; all identity now funnels through one `actorId`/`x-user-id` swap point |
| 12 | Lows | partial — poll back-off on hidden tab ✅ (both hooks); request-history pruning, heartbeat-fold, never-read-room sweeper, dead `blocked` enum, intentional Hindi content → left with rationale |
