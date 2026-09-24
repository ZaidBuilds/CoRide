/**
 * Seeds demo travelers into manual presence rooms on the Blue Line (3 rooms,
 * 30 users, varied bios and avatars) so the room screens have real data before
 * live users exist.
 *
 *   npx ts-node src/scripts/seedRoom.ts
 *   npx ts-node src/scripts/seedRoom.ts --clear
 *
 * Writes to BOTH stores on purpose: Redis holds presence, but
 * GET /api/room/:roomId resolves each id through persistence and drops anyone
 * without a profile. Seeding Redis alone would return count: 0.
 *
 * Ids are deterministic (seed_<pseudonym>), so re-running updates in place
 * rather than piling up duplicates.
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });
dotenv.config();
import { AVATAR_PALETTE } from '../data/metroData';
import { Persistence } from '../services/persistence';
import { pool } from '../db/pool';
import { RedisPresence, buildRoomId } from '../services/redisPresence';

const ROOMS = [
  buildRoomId({ station: 'rajiv_chowk', line: 'blue', direction: 'towards_noida_electronic_city_vaishali' }),
  buildRoomId({ station: 'rajiv_chowk', line: 'blue', direction: 'towards_dwarka_sector_21' }),
  buildRoomId({ station: 'barakhamba_road', line: 'blue', direction: 'towards_noida_electronic_city_vaishali' })
];

/** 30 distinct travelers — the app's ICP: Delhi campus + young professionals. */
const SEEDS: { pseudonym: string; bio: string; tags: string[] }[] = [
  { pseudonym: 'CosmicTiger',  bio: 'DU North Campus. Mostly here for the playlists.', tags: ['music', 'memes'] },
  { pseudonym: 'DelhiNomad',   bio: 'Commute is my reading hour.',                     tags: ['books', 'travel'] },
  { pseudonym: 'QuietStorm',   bio: 'Chess on the Blue Line. Beat me.',                tags: ['books', 'gaming'] },
  { pseudonym: 'ChaiByte',     bio: 'Backend dev. Runs on chai.',                      tags: ['coding', 'chai'] },
  { pseudonym: 'MetroSage',    bio: 'Ten years on this line. Ask me anything.',        tags: ['travel', 'food'] },
  { pseudonym: 'NeonBeat',     bio: 'Producing lo-fi between Rajiv Chowk and home.',   tags: ['music', 'art'] },
  { pseudonym: 'PixelRani',    bio: 'Design student. Sketching strangers politely.',   tags: ['design', 'art'] },
  { pseudonym: 'CricketAdda',  bio: 'Will talk about the match. Every match.',         tags: ['cricket', 'memes'] },
  { pseudonym: 'BiryaniFirst', bio: 'Rating every biryani near a metro gate.',         tags: ['food', 'biryani'] },
  { pseudonym: 'HostelOwl',    bio: 'Night owl, 8am commuter. It is fine.',            tags: ['hostel', 'gaming'] },
  { pseudonym: 'StartupSid',   bio: 'Building something small. Ask later.',            tags: ['startups', 'tech'] },
  { pseudonym: 'YogaOnRails',  bio: 'Breathing through rush hour.',                    tags: ['yoga', 'fitness'] },
  { pseudonym: 'FrameByFrame', bio: 'Street photography, mostly platforms.',           tags: ['photography', 'art'] },
  { pseudonym: 'AnimeAunty',   bio: 'Three episodes per commute.',                     tags: ['anime', 'movies'] },
  { pseudonym: 'CodeNinjaX',   bio: 'Pair programming with myself.',                   tags: ['coding', 'tech'] },
  { pseudonym: 'ChefCurry',    bio: 'Cooking vlogs between stations.',                  tags: ['food', 'cooking'] },
  { pseudonym: 'GymRatRavi',   bio: 'Gym, metro, gym.',                                tags: ['fitness', 'gym'] },
  { pseudonym: 'SonoShreya',   bio: 'Classical violinist, practicing mentally.',       tags: ['music', 'art'] },
  { pseudonym: 'ScribbleSid',  bio: 'Writes haikus about bogies.',                      tags: ['writing', 'books'] },
  { pseudonym: 'KebabQueen',   bio: 'Post-workout kebabs are non-negotiable.',          tags: ['food', 'fitness'] },
  { pseudonym: 'RailyardRavi', bio: 'Semis only. No answer on next train.',            tags: ['cricket', 'memes'] },
  { pseudonym: 'PlantPapa',    bio: 'Selling monstera cuttings from my backpack.',      tags: ['plants', 'design'] },
  { pseudonym: 'BingeBuddy',   bio: 'Rewatching office for the 14th time.',             tags: ['movies', 'memes'] },
  { pseudonym: 'ClimbChhaya',  bio: 'Bouldering on weekends, Blue Line weekdays.',      tags: ['fitness', 'travel'] },
  { pseudonym: 'RapidoRini',   bio: 'Fintech analyst. Excel is my dopamine.',           tags: ['tech', 'startups'] },
  { pseudonym: 'TiffinTara',   bio: 'Home-cooked tiffin evangelist.',                   tags: ['food', 'chai'] },
  { pseudonym: 'StrumSami',    bio: 'Ukulele on the platform, never on the train.',     tags: ['music', 'movies'] },
  { pseudonym: 'DataDev',      bio: 'SQL by day, WhatsApp by night.',                   tags: ['coding', 'tech'] },
  { pseudonym: 'MomoMohan',    bio: 'Steam momos before the turnstile.',                tags: ['food', 'biryani'] },
  { pseudonym: 'SketchSaanvi', bio: 'Comics of fellow commuters (with consent).',       tags: ['design', 'writing'] },
];

function roomFor(i: number): number {
  // 30 users → 10 per room, deterministic round-robin so each room always
  // reports the same 10 regardless of re-runs.
  return i % ROOMS.length;
}

function buildProfile(seed: (typeof SEEDS)[number], i: number) {
  const avatar = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
  return {
    id: `seed_${seed.pseudonym.toLowerCase()}`,
    username: `@${seed.pseudonym.toLowerCase()}`,
    pseudonym: seed.pseudonym,
    avatarId: avatar.id,
    avatarBg: avatar.bg,
    interestTags: seed.tags,
    bio: seed.bio,
    activity: 'IN_VEHICLE' as const,
    joinedAt: Date.now(),
    karmaScore: 0,
    trustTier: 'regular' as const
  };
}

async function main() {
  const clear = process.argv.includes('--clear');
  const persistence = Persistence.getInstance();
  // Postgres mode loads state asynchronously; seeding before that would be
  // refused (and could otherwise overwrite real data).
  await persistence.init();

  // The service's own client sets enableOfflineQueue:false so a down Redis fails
  // in ms instead of ~96s. That suits the long-lived server, which connects during
  // boot, but a short script issues its first command before the socket is ready
  // and would be rejected. Inject a client that queues until connected.
  const presence = RedisPresence.getInstance(
    new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')
  );

  const profiles = SEEDS.map(buildProfile);

  if (clear) {
    for (let i = 0; i < profiles.length; i++) {
      await presence.leaveRoom(profiles[i].id, ROOMS[roomFor(i)]);
    }
    console.log(`[seed] removed ${profiles.length} travelers across ${ROOMS.length} rooms`);
  } else {
    // Seeds have no heartbeat, so give them a long TTL (24h) — otherwise they'd
    // expire in the real 60s presence window and the demo room would empty out.
    const SEED_TTL = 24 * 60 * 60;
    for (let i = 0; i < profiles.length; i++) {
      persistence.appendProfile(profiles[i]);
      await presence.joinRoom(profiles[i].id, ROOMS[roomFor(i)], SEED_TTL);
    }
    console.log(`[seed] added ${profiles.length} travelers across ${ROOMS.length} rooms`);
    for (const room of ROOMS) {
      console.log(`  ${room} → ${await presence.countRoom(room)} live`);
    }
  }

  await persistence.flushNow();
  await presence.disconnect();
  if (pool) await pool.end();
}

main().catch(err => {
  console.error('[seed] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});