# CoRide Design System: "Platform"

> The single source of truth for how CoRide looks, reads and moves.
> Code lives in `client/src/index.css` (tokens) and `client/src/components/ui/` (primitives).
> If a screen needs something this file doesn't cover, extend this file first.

## 1. Idea

**The app wears your line.**
CoRide is built on one real-world system that every Delhi commuter already reads fluently:
the Delhi Metro, with its line colours, bilingual station signs and route diagrams.
We don't decorate the app with a brand gradient. We use **quiet concrete-and-ink neutrals**,
and let the **colour of the line you're riding** become the accent of the whole screen.
One brand colour, **Signal Lime**, is kept for identity and the single most important action.

What we deliberately avoid (the "AI app" look):
purple/indigo gradients, glassmorphism everywhere, glowing buttons, Inter + slate,
lucide icons, emoji in UI, circular avatars with initials on purple, three equal cards,
and fake numbers.

## 2. Colour

### Neutrals ("concrete and ink")
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-base` | `#ECEEEA` | `#0C0E11` | App background (platform concrete) |
| `--bg-surface` | `#F8F9F6` | `#15181C` | Cards, lists, sheets |
| `--bg-elevated` | `#FFFFFF` | `#1D2126` | Menus, dialogs, pressed-over surfaces |
| `--bg-sunken` | `#E2E5DF` | `#090B0D` | Inputs, segmented tracks, skeletons |
| `--ink` / `--text-primary` | `#111418` | `#EEF0F2` | Primary text and ink fills |
| `--text-secondary` | `#474D55` | `#B3B9C1` | Secondary text (AA on all surfaces) |
| `--text-muted` | `#646A73` | `#8D949E` | Meta, captions (AA on surface) |
| `--border-subtle` | `#D5D9D2` | `#262B31` | Hairlines |
| `--border-strong` | `#B9BEB6` | `#353B43` | Input borders, dividers that must read |

### Brand
| Token | Value | Rule |
|---|---|---|
| `--signal` | `#C8F031` (both themes) | Fill only. **Text on signal is always `--ink-fixed` `#111418`.** Never use lime as text colour or on light surfaces as a thin line. |
| `--signal-press` | `#B4DB22` | Pressed state of signal fills |
| `--ink-fixed` | `#111418` | Text/icons on signal |

Signal Lime is used for: the logo, the **one** primary CTA on a screen, the "you" marker
on route diagrams, unread badges, and the live indicator. Nothing else.

### Line colours (semantic data, not decoration)
Exact values live in `metroData` (`line.color`). A screen that is *about* a line sets
`style={{ '--line': line.color, '--line-ink': readableInk(line.color) }}` on its root, and
components read `--line` for rails, stubs, active tabs and progress.
`--line` defaults to `--ink` when there is no line context.
`--line-ink` is white or `#111418`, picked by contrast (Yellow/Aqua/Grey/Orange get dark ink).

### Status
`--status-danger #D93A2B / #FF6B5E`, `--status-warn #B7791F / #F2B544`, `--status-ok #1F8A4C / #4ECB85`.
Danger is only for destructive actions and errors.

### Buttons
- **Primary**: `--signal` fill, `--ink-fixed` text. At most one per screen.
- **Secondary**: `--ink` fill, `--bg-surface` text (inverts in dark).
- **Tonal**: `--bg-sunken` fill, `--text-primary` text.
- **Ghost**: text only, `--text-primary`, underline on focus.
- **Danger**: `--status-danger` fill, white text.

## 3. Type

**Anek** by Ek Type (Mumbai), OFL: a variable family with weight and **width** axes,
covering Latin and Devanagari. It is bundled (fontsource), so it works offline.

- `--font-ui: 'Anek Latin Variable', 'Anek Devanagari Variable', system-ui, sans-serif`
- `--font-hi: 'Anek Devanagari Variable', 'Anek Latin Variable', sans-serif` (use with `lang="hi"`)

| Role | Size/line | Weight | Width (`font-stretch`) | Notes |
|---|---|---|---|---|
| Display | 34/36 | 700 | 78% (condensed) | Screen titles, station names on signs |
| Title | 24/28 | 650 | 85% | Section/sheet titles |
| Headline | 19/24 | 600 | 100% | Card titles, names |
| Body | 16/23 | 420 | 100% | Default |
| Label | 14/18 | 560 | 100% | Buttons, chips, list titles |
| Meta | 13/17 | 480 | 100% | Secondary info |
| Micro | 11.5/14 | 620 | 100%, `letter-spacing: .04em`, uppercase | **Only** for line pills (e.g. `BLUE LINE`) |

Rules: numbers use `font-variant-numeric: tabular-nums`. No italics. No serif. No text gradients.
Hindi station names appear **under** the English name at Meta size in `--text-muted`, like DMRC signs.

## 4. Shape, space, elevation

- **Radius lock**: cards `16px`, sheets `24px` (top corners), inputs `12px`,
  **all buttons and chips are pills**, avatars are **squircles** (`border-radius: 34%`).
- **Spacing**: 4px grid. Gutter `16px`. Card padding `16px`. Section gap `24px`.
- **Touch**: minimum 48×48 targets.
- **Elevation**: flat by default. Cards separate from the background by colour, not shadow.
  Shadows only on floating layers (sheets, menus, toasts), tinted from `--ink`, never pure black.
- **Hairlines**: `1px --border-subtle`, used between list rows, never around every card *and* every row.

## 5. Signature components

1. **LineRail**: a 4px bar in `--line` with station nodes (hollow = stop, filled = you,
   lime ring = you right now). Used for journey, room header and check-in. It is real route
   data, never decoration.
2. **StationSign**: the station name in Display condensed, the Hindi name beneath, a line
   pill (`BLUE LINE` in Micro on `--line`), then `→ Towards Vaishali`. This is the hero
   of Home and Room.
3. **LinePill**: a pill filled with `--line`, text `--line-ink`, Micro type. Interchange = several pills.
4. **PresenceStack**: overlapping squircle avatars (max 4) plus a tabular count. A live dot
   pulses **only** when the count is real and greater than 0.
5. **Rider card**: a surface card with a 4px `--line` stub on the left edge, squircle
   avatar, name (Headline), shared interests as chips (shared ones filled `--signal`),
   and one action.

## 6. Iconography

**Phosphor** (`@phosphor-icons/react`), `regular` weight at 22–24px, and `fill` weight for
the active tab. One family only: no lucide, no emoji in UI chrome.

## 7. Motion

Motion explains state; it never decorates.
- Standard ease `cubic-bezier(.2,0,0,1)`, 160–240ms. Sheets use a spring-like
  `cubic-bezier(.32,.72,0,1)` over 320ms.
- Press: `scale(.97)` plus a light haptic.
- Live presence pulse: 2s, only when there is real live data.
- Lists stagger in once on first load (30ms steps, max 6 items).
- `prefers-reduced-motion` turns off everything except opacity fades.

## 8. Voice

Short, plain, and local. "3 riders on your coach side" beats "Discover amazing connections!".
Use the second person and present tense. No exclamation marks in UI chrome. No em-dashes.
Station and line names always come from `metroData`.

## 9. Location honesty

- We only say "On the train" or "At <station>" when the location engine's confidence supports it.
  Otherwise we say "Near <station>?" and offer one-tap confirm or change.
- The UI always shows which signal we used (GPS, your pick, or last check-in), in the Meta line.
- Other riders see the station and line, never coordinates.
