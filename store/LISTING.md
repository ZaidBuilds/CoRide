# CoRide Play Store listing

Paste these into Play Console → Grow → Store presence → Main store listing.
Character counts are checked against Play's limits.

## App name (30 max)

```
CoRide: Delhi Metro Riders
```
(26 characters)

## Short description (80 max)

```
See who's on your Delhi Metro line right now. Say hi, ride together, stay safe.
```
(79 characters)

## Full description (4000 max)

```
CoRide shows you the people riding the same Delhi Metro line as you, right now.

Open the app at Rajiv Chowk and see who else is on the Blue Line platform towards Noida. Check who shares your interests, send a request, and chat once they accept. When you get off, you leave the room.

WHAT YOU CAN DO
• See riders at your station or on your train, on every Delhi Metro line
• Know where you are: a station sign with Hindi names, like the ones on the platform
• Follow your journey on a route diagram, including the Blue Line fork to Vaishali
• Chat with people who accepted your request
• Join the platform chat, or play a quick game on a slow ride
• Save your daily commute and check in with one tap

PRIVATE BY DESIGN
• No phone number and no real name. You pick a display name.
• Other riders see your station and line, never your exact location.
• Location is used only while the app is open, never in the background.
• Only people you accept can message you.
• Honest location: the app shows whether it placed you by GPS or by your pick.

SAFETY
• Report or block anyone from their profile or chat
• Safety Centre with one-tap calls to 112, Women Helpline 1091, DMRC 155370 and CISF 155655
• Community rules everyone agrees to before joining
• CoRide is for people aged 18 and over

CoRide is an independent app and is not affiliated with Delhi Metro Rail Corporation (DMRC).
```

## Category and contact

- **App category:** Social
- **Tags:** Social, Travel & Local
- **Email:** collab.zaidbuilds@gmail.com
- **Privacy policy:** `https://<your-api>/privacy`

## Graphics (all in this folder)

| Asset | File | Play requirement |
|---|---|---|
| App icon | `icon-512.png` | 512×512 PNG |
| Feature graphic | `feature-graphic-1024x500.png` | 1024×500 PNG/JPG |
| Phone screenshots (8) | `screenshots/01-onboarding.png` … `08-safety.png` | 2 to 8 images, 1080×1920 (9:16) |

Suggested screenshot order: 02 Home, 03 Room, 05 Journey, 04 People, 06 Check-in, 01 Onboarding, 08 Safety, 07 Profile.
Screenshots show example riders from the demo data.

## Data safety answers

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Location: approximate and precise | Yes | No | Yes (you can pick your station by hand) | App functionality |
| Personal info: other (display name, bio, interests) | Yes | No | No | App functionality |
| Messages: other in-app messages | Yes | No | Yes | App functionality |
| App activity: app interactions | Yes | No | No | Analytics |

- Data encrypted in transit: **Yes**
- Users can request deletion: **Yes** (in the app, and at `https://<your-api>/account-deletion`)
- Location is processed "ephemerally"? **No.** Recent readings stay in server memory for up to an hour to keep detection steady. Answer the collection question as "Yes, collected", which is accurate.

## Content rating questionnaire (IARC)

- Users can interact or exchange content: **Yes**
- Shares user location with other users: **Yes, station level only**
- Allows purchases: **No**
- Target audience: **18+ only**
