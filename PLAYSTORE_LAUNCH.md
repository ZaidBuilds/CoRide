# CoRide — Play Store Launch Runbook

The Play build is the **Capacitor app in `client/`** (`com.coride.delhimetro`).
`mobile/` (Flutter) is gitignored and is not the launch target.

**The Play timing rule that sets the schedule:** a *personal* developer account
created after Nov 2023 must run a **closed test with at least 12 testers who stay
opted in for 14 days in a row** before Google lets you apply for production.
So the realistic path is: internal test (day 0) → closed test (days 1–15) →
production application (~day 16) → review (1–7 days).

---

## Phase 0 — Code blockers (done in this branch)

| Blocker | Fix |
|---|---|
| Every API call hard-coded to `http://localhost:4000` (on a phone that's the phone itself, so nothing would load) | One `client/src/config.ts` reading `VITE_API_URL` |
| `/api/auth/restore/:userId` gave out a login token for **any** user id (ids are visible in room lists), so anyone could take over any account | Now requires that user's existing signed token |
| `DELETE /api/profile/:userId` with no token deleted anyone | 401 without a token, 403 for someone else |
| Deletion didn't stick: friendships came back on the next save, and chats and requests were never removed | `ConnectionManager.purgeUser` + DM/read/commute purge |
| App cleared local data and said "deleted" even when the server refused | Only clears after a 2xx, otherwise shows an error |
| `PATCH /api/profile/:userId` let anyone edit anyone's profile | Owner only |
| `/api/admin/resolve` let anyone close safety reports | Needs `ADMIN_TOKEN` |
| No privacy-policy URL or web deletion URL (both required by Play) | `server/public/privacy.html` and `account-deletion.html`, served at `/privacy` and `/account-deletion` |
| Privacy label said "No GPS Tracking" while the app sends coordinates | Label fixed; the policy states coordinates are processed live and not stored |
| Unused `ACTIVITY_RECOGNITION` permission (a sensitive permission you'd have to justify) | Removed |
| No release signing | `build.gradle` reads `android/keystore.properties` |
| `cleartext: true` in production | Off unless `CAP_CLEARTEXT=true` |
| Server Dockerfile skipped devDependencies, so `tsc` failed | Full install → build → prune |

## Phase 1 — Host the backend (you, ~1 day)

1. Deploy `server/` (Dockerfile) to Render, Railway or Fly.io with a **custom HTTPS domain**.
2. Set env vars (full list with comments in `server/.env.example`):
   - `NODE_ENV=production`. The server then refuses to start without a strong `AUTH_SECRET`.
   - `AUTH_SECRET`: at least 32 random characters (`openssl rand -base64 48`). Changing it later logs everyone out.
   - `ADMIN_TOKEN`: a random string, for moderator routes (`x-admin-token` header).
   - `REDIS_URL`: a managed Redis (Upstash free tier works). Live presence needs it; without it, room routes return 503 instead of crashing.
   - Storage, pick one:
     - `DATABASE_URL` (managed Postgres). State loads at boot, and the server refuses to start if Postgres is unreachable.
     - `DATA_DIR` on a **persistent disk/volume**.

     Both run as **one instance only**: don't scale to 2+ replicas.
   - `CORS_ORIGINS`: only needed if you also host the web client. The Android app's origins are always allowed.
   - Once this build is live on every tester's phone, set `STRICT_AUTH=1`.
3. Check that `https://<your-api>/healthz`, `/privacy`, `/terms` and `/account-deletion` all respond.
4. Check that the contact email in those pages is the one you want public.

## Phase 2 — Build the signed AAB (you, ~1 hour)

```bash
# once: create the upload key — back it up; losing it means a support ticket to reset
keytool -genkeypair -v -keystore coride-upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
cp client/android/keystore.properties.example client/android/keystore.properties
# edit storeFile/passwords

cd client
echo "VITE_API_URL=https://<your-api>" > .env.production
npm ci && npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

For every later upload, raise `versionCode` in `client/android/app/build.gradle`.

## Phase 3 — Play Console setup (you, ~half a day)

**App content** (Policy → App content):

| Section | Answer |
|---|---|
| Privacy policy | `https://<your-api>/privacy` |
| Ads | **No** (the Capacitor app has no ad SDK) |
| App access | All features available without login (anonymous profile) |
| Target audience | **18+ only.** It's a chat-with-strangers app; picking younger ages triggers Families policy |
| Content rating | Answer **Yes** to "users can interact / exchange messages" and "shares location with other users". Expect a Teen/Mature-type rating |
| Data safety → deletion URL | `https://<your-api>/account-deletion` |
| Government / financial / health | No |

**Data safety form**, based on what the code actually does:

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Location: approximate + precise | Yes (processed, not stored) | No | Yes (manual station picker works without it) | App functionality |
| Personal info: other (pseudonym, bio, interest tags) | Yes | No | No | App functionality |
| Messages: other in-app messages | Yes | No | Yes | App functionality |
| App activity: app interactions | Yes | No | No | Analytics |
| Device IDs | No | — | — | — |

Encrypted in transit: **Yes** (HTTPS). Users can request deletion: **Yes**.

**Store listing:** app name, short description (80 chars), full description,
512×512 icon, 1024×500 feature graphic, and at least 2 phone screenshots.
Say in the description that it's for Delhi Metro and that users are pseudonymous.

## Phase 4 — Test tracks

1. **Internal testing** (instant, up to 100 people): upload the AAB and install on your own phone.
   Test the full path: onboarding → location prompt → room → connect → chat → report/block → delete account.
2. **Closed testing**: add **12+ testers** by Google Group or email list. They must opt in
   through the link **and stay opted in for 14 days**. Recruit 15–20 people, because a few will drop out.
   Ask them for feedback. Google's production questionnaire asks what you learned from testing.
3. After 14 days: Dashboard → **Apply for production**.

## Known gaps (fine for closed test, fix before public production)

- Identity is an anonymous device token. Reinstalling the app loses the account,
  with no way to recover it. Add Google Sign-In or phone OTP before scaling.
- **Android Back button** closes the app from every screen until you run
  `cd client && npm i @capacitor/app && npx cap sync android`. The back handling
  is already written; the plugin switches it on.
- **Launcher icon and splash** are still Capacitor defaults. Generate them with
  `npx @capacitor/assets generate` before the store listing.
- There is no moderator screen. Reports are stored, and you resolve them with `curl -H "x-admin-token: …"`.
- Room chat in a live room isn't stored, so people who join late see an empty chat.
  DMs load the last 50 messages, with no paging yet.
- No "seen" receipts in DMs yet.
- One server instance only (both storage modes).
- Check the Safety Centre helpline numbers (112, 1091, DMRC 155370, CISF 155655) before launch.
