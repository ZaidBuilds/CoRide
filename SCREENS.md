# CoRide Screen Audit — KEEP / CUT

Audit only, no code changed. Each element is judged **only** against its screen's
one question. Anything that doesn't serve the question is **CUT**. "Fake" =
hardcoded/placeholder data with no backend.

---

## Home — *who's around me?*
File: `HomeScreen.tsx`

| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Header: CoRide title + greeting | KEEP | orientation |
| Header: ThemeToggle | KEEP | utility, unobtrusive |
| Header: Safety-centre button | CUT | goes nowhere; not "who's around" |
| Header: Notifications bell + pip | CUT | no notification system; fake pip |
| "Your journey, your people" hero line | CUT | slogan, answers nothing |
| On Ride · Live Presence card → View Room | KEEP | the live context = who's around |
| Around You Now (avatars + % match) | KEEP | directly answers the question |
| Around You Now empty state | KEEP | honest zero-state |
| Quick Actions grid (Chat/Quiz/Ice Breaker/Add Post) | CUT | actions, not presence; Quiz/IceBreaker/Post are stubs |
| Active Rooms list | KEEP (real only) | other live rooms = who's around; **CUT the hardcoded demo rooms** |

---

## People — *who can I meet?*
File: `DiscoveryScreen.tsx`

| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Title "Blue Line" + station → direction | KEEP | context for who's here |
| "N travelers online" purple card | KEEP | scale of who I can meet |
| "Train Info" button (on that card) | CUT | dead button, not about people |
| Next-station line (`nextTime` hardcoded) | CUT | fake schedule data |
| Filter tabs All / Nearby / Friends | KEEP | narrows who I can meet |
| "People you may vibe with" ranked strip | KEEP | the core answer |
| Traveler list (TravelerCard ×N) | KEEP | the core answer |
| Empty-filter state | KEEP | honest zero-state |
| Bottom "Filters" button | CUT | dead button (no filter sheet) |
| Bottom Search button | CUT | dead button (no search) |
| "Open Station/Train Chat" CTA | CUT | that's the Room, not meeting people |

---

## TravelerProfile — *would I want to connect?*
Files: `ProfileSheet.tsx` + `ProfileSheetContent.tsx` + `ProfileSheetActions.tsx`
(Note: some lists still open the older `ProfileDrawer.tsx` — see below.)

| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Drag handle / backdrop / swipe-dismiss | KEEP | sheet mechanics |
| Large avatar + live dot | KEEP | who they are |
| Name + @username | KEEP | identity |
| Bio | KEEP | the decision input |
| Joined date (when present) | KEEP | trust signal |
| "Send request" pill (idle/sending/sent/friends) | KEEP | the action the question leads to |
| Overflow → Report / Block | KEEP | safety is part of "would I" |

`ProfileSheet*` is tight — everything serves the question. **No CUTs.**

### ProfileDrawer.tsx (legacy full-screen profile)
| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Avatar, name, badge, bio, interest tags | KEEP | decision inputs |
| Connect / Message / Block / Report | KEEP | actions + safety |
| Hardcoded "mutual friends" row (QuietStorm_91, …) | CUT | fabricated social proof |
| Hardcoded "Top Games" wins (Word Chain 124, etc.) | CUT | fabricated stats, not decision inputs |
| Hardcoded interests/about fallback strings | CUT | fake data misrepresents the person |
| Header ⋮ options button | CUT | dead button |
| "8 stops left to Noida Sec 18" line | CUT | hardcoded journey detail, belongs to Journey |
| "Active on ● Blue Line • Rajiv Chowk → Noida" | CUT | hardcoded context |
| Safe Connections banner | KEEP | trust, part of "would I" |

**Dedup:** two profile UIs exist (sheet + drawer). Not an element CUT — flag, don't delete blindly.

---

## Room — *what's happening right now?*
File: `RoomScreen.tsx`

| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Nav bar: back, "Station · N live", refresh | KEEP | room identity + live scale |
| Large "Live Room" title | KEEP | context |
| Live dot + "N travelers live" + updated time | KEEP | liveness |
| Station segmented control | KEEP | which room |
| Line & direction list | KEEP | which room |
| Room hero panel (train icon, station, line, direction, live count) | KEEP | what's happening summary |
| Error banner + Retry | KEEP | honest failure state |
| Active Travelers header + count + "Poll status" | KEEP | list header; label says polling honestly |
| Loading skeletons | KEEP | honest loading |
| Empty state "No one here yet" + Check again | KEEP | honest zero-state |
| Traveler cards (avatar/dot, name, bio, tags, Connect) | KEEP | the core answer |
| Hardcoded "Active" badge on every traveler | CUT | always-on fake; B1 will make it real per-user |
| Footer pill: Room key + "Binary Redis TTL presence" | CUT | debug info, answers nothing |
| ProfileSheet / ReportSheet / toast | KEEP | the action layer |

---

## Chat — *who am I talking to?*
### Room chat — `ChatView.tsx`
| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Header: line bound + station → next + online count | KEEP | who's in the conversation |
| "X stops left / Noida Sec 18" status line | CUT | journey info, not who I'm talking to |
| "{online} online / {nearby} nearby" | CUT | crowding; nearby isn't identity |
| "Room Info" button | CUT | dead button |
| Pinned rules banner | KEEP | governs the conversation |
| Message bubbles + avatars + timestamps | KEEP | the conversation |
| "Admin" badge on hardcoded CosmicTiger_44 | CUT | hardcoded identity |
| "✓✓" read receipt (always rendered) | CUT | fake receipt |
| ReactionBar on messages | KEEP | part of conversation |
| Typing indicator | KEEP | who is talking to me |
| FAB "Play Game" | CUT | games, not conversation |
| Composer: input + send | KEEP | the conversation act |
| "+" attachment + "☺" emoji buttons | CUT | dead buttons |
| Footer "Ephemeral • Clears after commute" | KEEP | honest ephemerality |

### Direct chat — `DirectChatScreen.tsx` (+ `MessageList.tsx`)
| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Header: back, avatar, name | KEEP | who I'm talking to |
| "Metro Friend" subtitle | CUT | generic filler, says nothing |
| MessageList rows (bubble, sender, time) | KEEP | the conversation |
| Empty state "say hello" | KEEP | honest zero-state |
| Composer + send | KEEP | the conversation act |
| Poll error line | KEEP | honest failure state |

### Chat list — `ChatsScreen.tsx`
| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Header "Chats" | KEEP | page identity |
| Search + New-chat buttons | CUT | dead buttons |
| Stories row (Ishita/Kabir/Mehak/Rohan hardcoded) | CUT | fabricated; no stories feature |
| Real friend chats (mapped from connections) | KEEP | who I talk to |
| Hardcoded chat list (Aryan, Travel Buddies group, Tech Hub, Family Group, voice note, muted rows) | CUT | fabricated threads |
| Hardcoded unread badges / times / durations | CUT | fake |
| Privacy card ("Your privacy matters") | KEEP | trust |

---

## Journey — *where am I going?*
File: `LiveTrackingScreen.tsx`

| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Header title + back | KEEP | page identity |
| Share journey + More options buttons | CUT | dead buttons |
| Blue Line card (line, route) | KEEP | where am I going |
| Card: "On Time", "Next stop in 3 min" | CUT | hardcoded fake times |
| Map (grid + path + markers) | CUT | placeholder; no real map/geodata yet |
| Map overlays: "Departed 9:20 AM", "9:34 AM", "Arrive 9:52 AM", recentre, layer buttons | CUT | hardcoded fake times / dead buttons |
| Journey Progress (stops, times, % done) | CUT | all hardcoded |
| Crowd in Coach | CUT | fake crowding data |
| Arrival Alert | CUT | fake schedule |
| Total Time | CUT | fake |
| "Save this Journey" toggle | CUT | toggle does nothing (dead) |

**(Screen keeps only its header + the Blue Line route card until Journey gets real route data — Track C.)**

---

## MyProfile — *who am I on CoRide?*
File: `ProfileStatsScreen.tsx`

| Element | KEEP/CUT | Why |
|---------|----------|-----|
| Header "Profile" + ThemeToggle | KEEP | page identity + utility |
| Header bell ("3 unread") | CUT | fake notification count |
| Profile card: avatar, name, @username | KEEP | who I am |
| Verified "✔" badge | CUT | fake status |
| "Explorer" "📍 Meerut" "Since Jan 2024" | CUT | all hardcoded |
| Edit (✏️) on avatar | KEEP | editing who I am |
| Level 12 / XP progress bar | CUT | fabricated gamification |
| Journey Stats (128 rides, 412 km, credits) | CUT | hardcoded |
| 14 Day Streak + week dots | CUT | hardcoded |
| Achievements + View all | CUT | hardcoded |
| Recent Activity + View all | CUT | hardcoded |
| My Rides / Saved Routes / Preferences buttons | CUT | dead buttons |
| Go Premium card | CUT | monetization, not identity (moves to its own surface in Track E) |

**(Screen keeps identity: avatar, name, username, edit access — until real stats endpoints exist.)**

---

## Dedup flags (not element CUTs)
- **Home vs `DiscoverAroundYou.tsx`:** two Home-like screens. Whichever isn't the routed tab is dead; keep one.
- **`ChatsScreen.tsx` vs `ConnectScreen`/friends:** the only real "chats" are 1:1 threads with friends; the list should render only those.
- **ProfileSheet vs ProfileDrawer:** migrate remaining openers to ProfileSheet, delete drawer.