import { MetroLine } from '../types';

export const DELHI_METRO_LINES: MetroLine[] = [
  {
    id: 'blue',
    name: 'Blue Line',
    color: '#0284c7',
    accentColor: '#38bdf8',
    terminalA: 'Dwarka Sector 21',
    terminalB: 'Noida Electronic City / Vaishali',
    stations: [
      { id: 'dwarka_sec_21', name: 'Dwarka Sector 21', hindiName: 'द्वारका सेक्टर २१', lat: 28.5522, lng: 77.0583, lineId: 'blue', order: 1, isInterchange: true, interchangeLines: ['orange'], isUnderground: true, cellTowerId: 'TOWER_DMRC_DWK21', averagePressureHpa: 1011.5 },
      { id: 'dwarka_mor', name: 'Dwarka Mor', hindiName: 'द्वारका मोड़', lat: 28.6192, lng: 77.0326, lineId: 'blue', order: 2, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_DWMOR', averagePressureHpa: 1008.2 },
      { id: 'janakpuri_west', name: 'Janakpuri West', hindiName: 'जनकपुरी पश्चिम', lat: 28.6294, lng: 77.0777, lineId: 'blue', order: 3, isInterchange: true, interchangeLines: ['magenta'], isUnderground: false, cellTowerId: 'TOWER_DMRC_JKPW', averagePressureHpa: 1008.1 },
      { id: 'rajouri_garden', name: 'Rajouri Garden', hindiName: 'राजौरी गार्डन', lat: 28.6493, lng: 77.1226, lineId: 'blue', order: 4, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_RG', averagePressureHpa: 1008.0 },
      { id: 'kirti_nagar', name: 'Kirti Nagar', hindiName: 'कीर्ति नगर', lat: 28.6558, lng: 77.1497, lineId: 'blue', order: 5, isInterchange: true, interchangeLines: ['green'], isUnderground: false, cellTowerId: 'TOWER_DMRC_KN', averagePressureHpa: 1008.0 },
      { id: 'karol_bagh', name: 'Karol Bagh', hindiName: 'करोल बाग', lat: 28.6443, lng: 77.1901, lineId: 'blue', order: 6, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_KB', averagePressureHpa: 1008.3 },
      { id: 'rajiv_chowk', name: 'Rajiv Chowk (Connaught Place)', hindiName: 'राजीव चौक', lat: 28.6328, lng: 77.2197, lineId: 'blue', order: 7, isInterchange: true, interchangeLines: ['yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_RC_CP', averagePressureHpa: 1012.8 },
      { id: 'barakhamba_road', name: 'Barakhamba Road', hindiName: 'बाराखंभा रोड', lat: 28.6300, lng: 77.2272, lineId: 'blue', order: 8, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_BKRD', averagePressureHpa: 1012.5 },
      { id: 'mandi_house', name: 'Mandi House', hindiName: 'मंडी हाउस', lat: 28.6258, lng: 77.2343, lineId: 'blue', order: 9, isInterchange: true, interchangeLines: ['violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_MDH', averagePressureHpa: 1012.4 },
      { id: 'supreme_court', name: 'Supreme Court', hindiName: 'सुप्रीम कोर्ट', lat: 28.6186, lng: 77.2435, lineId: 'blue', order: 10, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SCPM', averagePressureHpa: 1008.1 },
      { id: 'yamuna_bank', name: 'Yamuna Bank', hindiName: 'यमुना बैंक', lat: 28.6231, lng: 77.2662, lineId: 'blue', order: 11, isInterchange: true, interchangeLines: ['blue_branch'], isUnderground: false, cellTowerId: 'TOWER_DMRC_YB', averagePressureHpa: 1007.8 },
      { id: 'mayur_vihar_1', name: 'Mayur Vihar 1', hindiName: 'मयूर विहार १', lat: 28.6047, lng: 77.2947, lineId: 'blue', order: 12, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_MV1', averagePressureHpa: 1007.9 },
      { id: 'noida_sec_18', name: 'Noida Sector 18 (Atta Market)', hindiName: 'नोएडा सेक्टर १८', lat: 28.5708, lng: 77.3261, lineId: 'blue', order: 13, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N18', averagePressureHpa: 1008.0 },
      { id: 'botanical_garden', name: 'Botanical Garden', hindiName: 'बॉटनिकल गार्डन', lat: 28.5642, lng: 77.3341, lineId: 'blue', order: 14, isInterchange: true, interchangeLines: ['magenta'], isUnderground: false, cellTowerId: 'TOWER_DMRC_BG', averagePressureHpa: 1008.1 },
      { id: 'noida_electronic_city', name: 'Noida Electronic City', hindiName: 'नोएडा इलेक्ट्रॉनिक सिटी', lat: 28.6277, lng: 77.3739, lineId: 'blue', order: 15, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_NEC', averagePressureHpa: 1008.2 }
    ]
  },
  {
    id: 'yellow',
    name: 'Yellow Line',
    color: '#eab308',
    accentColor: '#fde047',
    terminalA: 'Samaypur Badli',
    terminalB: 'Millennium City Centre Gurugram',
    stations: [
      { id: 'vishwavidyalaya', name: 'Vishwavidyalaya (DU North Campus)', hindiName: 'विश्वविद्यालय', lat: 28.6946, lng: 77.2144, lineId: 'yellow', order: 1, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_DU_NC', averagePressureHpa: 1012.6 },
      { id: 'kashmere_gate', name: 'Kashmere Gate', hindiName: 'कश्मीरी गेट', lat: 28.6675, lng: 77.2285, lineId: 'yellow', order: 2, isInterchange: true, interchangeLines: ['red', 'violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_KG', averagePressureHpa: 1013.2 },
      { id: 'chandni_chowk', name: 'Chandni Chowk', hindiName: 'चाँदनी चौक', lat: 28.6578, lng: 77.2303, lineId: 'yellow', order: 3, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_CC', averagePressureHpa: 1012.9 },
      { id: 'new_delhi', name: 'New Delhi Railway Station', hindiName: 'नई दिल्ली', lat: 28.6431, lng: 77.2223, lineId: 'yellow', order: 4, isInterchange: true, interchangeLines: ['orange'], isUnderground: true, cellTowerId: 'TOWER_DMRC_NDLS', averagePressureHpa: 1012.7 },
      { id: 'rajiv_chowk_y', name: 'Rajiv Chowk (Connaught Place)', hindiName: 'राजीव चौक', lat: 28.6328, lng: 77.2197, lineId: 'yellow', order: 5, isInterchange: true, interchangeLines: ['blue'], isUnderground: true, cellTowerId: 'TOWER_DMRC_RC_CP', averagePressureHpa: 1012.8 },
      { id: 'central_secretariat', name: 'Central Secretariat', hindiName: 'केंद्रीय सचिवालय', lat: 28.6147, lng: 77.2119, lineId: 'yellow', order: 6, isInterchange: true, interchangeLines: ['violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_CS', averagePressureHpa: 1012.6 },
      { id: 'hauz_khas', name: 'Hauz Khas (IIT Delhi)', hindiName: 'हौज़ खास', lat: 28.5434, lng: 77.2064, lineId: 'yellow', order: 7, isInterchange: true, interchangeLines: ['magenta'], isUnderground: true, cellTowerId: 'TOWER_DMRC_HK', averagePressureHpa: 1013.5 },
      { id: 'saket', name: 'Saket', hindiName: 'साकेत', lat: 28.5204, lng: 77.2016, lineId: 'yellow', order: 8, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_SKT', averagePressureHpa: 1012.4 },
      { id: 'cyber_city_sikanderpur', name: 'Sikanderpur (DLF CyberCity)', hindiName: 'सिकंदरपुर', lat: 28.4819, lng: 77.0927, lineId: 'yellow', order: 9, isInterchange: true, interchangeLines: ['rapid_metro'], isUnderground: false, cellTowerId: 'TOWER_DMRC_SKP', averagePressureHpa: 1008.2 },
      { id: 'millennium_city_centre', name: 'Millennium City Centre Gurugram', hindiName: 'मिलेनियम सिटी सेंटर', lat: 28.4593, lng: 77.0725, lineId: 'yellow', order: 10, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MCCG', averagePressureHpa: 1008.1 }
    ]
  }
];

// ────────────────────────────────────────
// Beachhead config — PRD §2 "one high-density corridor"
// Set BEACHHEAD_LINE env to filter corridor for MVP launch.
// Default: blue (Rajiv Chowk → Botanical cluster is highest density).
// Set BEACHHEAD_LINE=all to expose all lines (post-validation).
// Set BEACHHEAD_STATIONS=rajiv_chowk:botanical_garden to limit to slice.
// ────────────────────────────────────────
function env(key: string): string | undefined {
  try { return process.env[key]; } catch { return undefined; }
}

function getBeachheadLine(): string {
  return (env('BEACHHEAD_LINE') || 'blue').toLowerCase();
}
function getBeachheadStationsEnv(): string {
  return env('BEACHHEAD_STATIONS') || '';
}

export function getActiveMetroLines(): import('../types').MetroLine[] {
  const beachheadLine = getBeachheadLine();
  const stationsEnv = getBeachheadStationsEnv();
  let lines = DELHI_METRO_LINES;
  if (beachheadLine !== 'all') {
    lines = lines.filter(l => l.id === beachheadLine);
    if (lines.length === 0) lines = DELHI_METRO_LINES.filter(l => l.id === 'blue');
  }
  if (stationsEnv && stationsEnv.includes(':')) {
    const [startId, endId] = stationsEnv.split(':');
    lines = lines.map(line => {
      const sI = line.stations.findIndex(s => s.id === startId);
      const eI = line.stations.findIndex(s => s.id === endId);
      if (sI >= 0 && eI >= 0) {
        const lo = Math.min(sI, eI), hi = Math.max(sI, eI);
        return { ...line, stations: line.stations.slice(lo, hi + 1) };
      }
      return line;
    });
  }
  return lines;
}

export function getBeachheadInfo() {
  const line = getBeachheadLine();
  const stationsEnv = getBeachheadStationsEnv();
  return {
    line,
    stationsEnv,
    activeLines: getActiveMetroLines().map(l => ({ id: l.id, name: l.name, stations: l.stations.length })),
    isBeachhead: line !== 'all'
  };
}

export const AVATAR_PALETTE = [
  { id: 'av_1', name: 'Cosmic Tiger', initials: 'CT', bg: 'linear-gradient(135deg, #f97316, #ef4444)' },
  { id: 'av_2', name: 'Quiet Storm', initials: 'QS', bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  { id: 'av_3', name: 'Delhite Pro', initials: 'D2', bg: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
  { id: 'av_4', name: 'Metro Sage', initials: 'MS', bg: 'linear-gradient(135deg, #10b981, #059669)' },
  { id: 'av_5', name: 'Cyber Chai', initials: 'CC', bg: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
  { id: 'av_6', name: 'Neon Beat', initials: 'NB', bg: 'linear-gradient(135deg, #eab308, #f97316)' }
];

export const TELEGRAM_STYLE_USERNAMES = [
  { username: 'CosmicTiger_44', tags: ['music', 'memes'] },
  { username: 'QuietStorm_91', tags: ['books', 'coding'] },
  { username: 'Delhite_22', tags: ['explore', 'food'] },
  { username: 'BlueFalcon_99', tags: ['tech', 'startups'] },
  { username: 'MetroNomad_07', tags: ['travel', 'photography'] },
  { username: 'UrbanChai_33', tags: ['design', 'coffee'] },
  { username: 'DURider_18', tags: ['du_campus', 'spotify'] },
  { username: 'CricketFever_11', tags: ['cricket', 'gaming'] },
  { username: 'CodeNinja_08', tags: ['coding', 'gaming'] },
  { username: 'BiryaniLove_27', tags: ['food', 'travel'] },
  { username: 'GamerX_99', tags: ['gaming', 'anime'] },
  { username: 'BookWorm_13', tags: ['books', 'music'] },
  { username: 'ChaiPoint_45', tags: ['chai', 'memes'] },
  { username: 'FitnessFreak_22', tags: ['fitness', 'yoga'] },
];

export function getRandomTelegramProfile() {
  const item = TELEGRAM_STYLE_USERNAMES[Math.floor(Math.random() * TELEGRAM_STYLE_USERNAMES.length)];
  const avatar = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
  return {
    username: `@${item.username}`,
    pseudonym: item.username,
    avatarId: avatar.id,
    avatarBg: avatar.bg,
    interestTags: item.tags
  };
}
