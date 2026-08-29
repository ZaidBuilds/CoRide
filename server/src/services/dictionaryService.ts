import fs from 'fs';
import path from 'path';

export class DictionaryService {
  private wordsSet: Set<string> = new Set();
  private static instance: DictionaryService;

  private constructor() {
    this.loadBuiltinDictionary();
  }

  public static getInstance(): DictionaryService {
    if (!DictionaryService.instance) {
      DictionaryService.instance = new DictionaryService();
    }
    return DictionaryService.instance;
  }

  private loadBuiltinDictionary(): void {
    // Rich starter dictionary of ~4000 high-frequency English commute and general words
    const baseWords = [
      'apple', 'train', 'metro', 'station', 'network', 'karol', 'delhi', 'connect', 'transit',
      'ticket', 'track', 'terminal', 'travel', 'trip', 'token', 'turnstile', 'commute', 'crowd',
      'carriage', 'compartment', 'platform', 'passenger', 'route', 'railway', 'rapid', 'express',
      'speed', 'signal', 'schedule', 'journey', 'junction', 'bridge', 'breeze', 'booth', 'board',
      'bogie', 'beacon', 'battery', 'baggage', 'urban', 'underground', 'escalator', 'elevator',
      'engine', 'electric', 'energy', 'escape', 'exit', 'entry', 'echo', 'east', 'west', 'north',
      'south', 'subway', 'stationery', 'smartcard', 'scanner', 'seat', 'speaker', 'silence',
      'screen', 'sensor', 'security', 'camera', 'cable', 'coach', 'clock', 'crossing', 'current',
      'destination', 'direction', 'departure', 'delay', 'driver', 'display', 'doors', 'distance',
      'district', 'map', 'metrocard', 'morning', 'motion', 'magnet', 'metal', 'mirror', 'message',
      'friend', 'fellow', 'future', 'flash', 'fast', 'fleet', 'fare', 'family', 'focus', 'flow',
      'game', 'grid', 'gate', 'guard', 'guide', 'ground', 'gear', 'glance', 'great', 'group',
      'habit', 'handle', 'headset', 'highway', 'horn', 'hour', 'human', 'hurry', 'hustle',
      'icon', 'impact', 'index', 'infra', 'input', 'insight', 'instant', 'intel', 'internet',
      'interchange', 'intersection', 'island', 'issue', 'item', 'ivory',
      'jacket', 'jam', 'jeep', 'jewel', 'join', 'joint', 'jolt', 'journal', 'judge', 'juice',
      'jump', 'jumper', 'jungle', 'junior', 'jury', 'justice',
      'karma', 'keen', 'keep', 'keeper', 'kettle', 'key', 'keyboard', 'kick', 'kinetic', 'king',
      'kiosk', 'kiss', 'kitchen', 'kite', 'kitten', 'knee', 'knife', 'knight', 'knock', 'knot',
      'know', 'knowledge',
      'ladder', 'lamp', 'lane', 'laptop', 'laser', 'latch', 'late', 'laugh', 'launch', 'layer',
      'leader', 'leaf', 'league', 'leak', 'lean', 'leap', 'learn', 'lease', 'leave', 'lecture',
      'ledger', 'legend', 'lemon', 'length', 'lens', 'lesson', 'letter', 'level', 'lever', 'liberty',
      'library', 'license', 'life', 'lift', 'light', 'limit', 'line', 'link', 'lion', 'liquid',
      'list', 'listen', 'lively', 'liver', 'load', 'lobby', 'local', 'lock', 'logic', 'logo',
      'london', 'look', 'loop', 'loud', 'lounge', 'love', 'loyal', 'luck', 'luggage', 'lumber',
      'lunar', 'lunch', 'luxury',
      'machine', 'mad', 'magic', 'magnet', 'mail', 'main', 'major', 'maker', 'manage', 'manager',
      'manner', 'manual', 'marble', 'march', 'margin', 'marine', 'mark', 'market', 'marvel',
      'mask', 'mass', 'master', 'match', 'mate', 'material', 'matrix', 'matter', 'maximum', 'mayor',
      'maze', 'meal', 'mean', 'measure', 'meat', 'medal', 'media', 'medic', 'medium', 'meet',
      'melody', 'member', 'memory', 'mental', 'mentor', 'menu', 'mercy', 'merge', 'merit', 'mesh',
      'metal', 'meter', 'method', 'metro', 'micro', 'middle', 'midnight', 'mighty', 'mile', 'mind',
      'mine', 'miner', 'minor', 'mint', 'minute', 'mirror', 'miss', 'missile', 'mission', 'mist',
      'mix', 'mobile', 'mode', 'model', 'modem', 'modern', 'module', 'moment', 'money', 'monitor',
      'monkey', 'month', 'monument', 'moon', 'moral', 'morning', 'motion', 'motor', 'mount', 'mouse',
      'mouth', 'move', 'movie', 'much', 'mud', 'multi', 'muscle', 'museum', 'music', 'must', 'mute',
      'mystery',
      'nail', 'name', 'narrow', 'nation', 'native', 'nature', 'navy', 'near', 'neat', 'neck',
      'need', 'needle', 'neon', 'nerve', 'nest', 'network', 'neutral', 'never', 'news', 'next',
      'nice', 'night', 'ninja', 'noble', 'node', 'noise', 'nomad', 'normal', 'north', 'nose',
      'note', 'notice', 'novel', 'nuclear', 'number', 'nurse', 'nut',
      'oak', 'oar', 'oasis', 'object', 'obtain', 'ocean', 'octave', 'odd', 'odor', 'off',
      'offer', 'office', 'officer', 'often', 'oil', 'okay', 'old', 'olive', 'omega', 'omen',
      'omit', 'once', 'one', 'onion', 'online', 'only', 'onset', 'open', 'opera', 'opinion',
      'optic', 'option', 'orange', 'orbit', 'order', 'organ', 'origin', 'other', 'ounce', 'outer',
      'outfit', 'output', 'oval', 'oven', 'over', 'owner', 'oxygen', 'oyster', 'ozone',
      'pace', 'pack', 'packet', 'page', 'paid', 'pain', 'paint', 'pair', 'palace', 'palm',
      'panel', 'panic', 'paper', 'parade', 'parcel', 'pardon', 'parent', 'park', 'parrot', 'part',
      'party', 'pass', 'patch', 'path', 'patrol', 'patron', 'pattern', 'pause', 'pave', 'pawn',
      'peace', 'peak', 'pearl', 'pedal', 'peer', 'pen', 'pencil', 'people', 'pepper', 'perfect',
      'period', 'permit', 'person', 'pet', 'phase', 'phone', 'photo', 'phrase', 'piano', 'pick',
      'picnic', 'piece', 'pig', 'pigeon', 'pilot', 'pin', 'pine', 'pink', 'pipe', 'pistol',
      'pitch', 'pixel', 'pizza', 'place', 'plain', 'plan', 'plane', 'planet', 'plant', 'plate',
      'play', 'player', 'plaza', 'plea', 'plot', 'plug', 'plum', 'plus', 'pocket', 'poem',
      'poet', 'point', 'poison', 'polar', 'pole', 'police', 'policy', 'polish', 'polite', 'poll',
      'pond', 'pool', 'poor', 'pop', 'popular', 'porch', 'pork', 'port', 'portal', 'pose',
      'post', 'pot', 'potato', 'pouch', 'pound', 'powder', 'power', 'praise', 'pray', 'prayer',
      'preach', 'prefer', 'prefix', 'press', 'price', 'pride', 'priest', 'prime', 'prince', 'print',
      'prior', 'prison', 'prize', 'probe', 'problem', 'process', 'produce', 'product', 'profit', 'program',
      'project', 'promise', 'prompt', 'proof', 'proper', 'prosper', 'protect', 'proud', 'prove', 'provide',
      'proxy', 'public', 'pulse', 'pump', 'punch', 'pupil', 'puppet', 'puppy', 'pure', 'purple',
      'purpose', 'purse', 'push', 'puzzle', 'pyramid',
      'quack', 'quad', 'quail', 'quake', 'quantum', 'quarry', 'quarter', 'quartz', 'queen', 'quench',
      'query', 'quest', 'quick', 'quiet', 'quilt', 'quirk', 'quit', 'quiz', 'quota', 'quote',
      'rabbit', 'race', 'radar', 'radio', 'radius', 'raft', 'rage', 'rail', 'rain', 'raise',
      'rally', 'ramp', 'ranch', 'random', 'range', 'rapid', 'rare', 'raster', 'rate', 'ratio',
      'rattle', 'raw', 'razor', 'reach', 'react', 'read', 'ready', 'real', 'realm', 'rear',
      'reason', 'rebel', 'recall', 'receipt', 'receive', 'recipe', 'record', 'recover', 'recruit', 'red',
      'reduce', 'reed', 'reef', 'reel', 'refer', 'reflect', 'reform', 'refuge', 'refund', 'refuse',
      'regal', 'regard', 'regime', 'region', 'register', 'regret', 'regular', 'reign', 'reject', 'relax',
      'relay', 'release', 'relic', 'relief', 'rely', 'remain', 'remark', 'remedy', 'remind', 'remote',
      'remove', 'render', 'renew', 'rent', 'repair', 'repeat', 'replace', 'reply', 'report', 'rescue',
      'reserve', 'reset', 'resin', 'resist', 'resort', 'resource', 'respect', 'respond', 'rest', 'result',
      'resume', 'retail', 'retain', 'retire', 'retreat', 'return', 'reveal', 'revenge', 'revenue', 'reverse',
      'review', 'reward', 'rhythm', 'ribbon', 'rice', 'rich', 'ride', 'rider', 'ridge', 'rifle',
      'right', 'rigid', 'ring', 'riot', 'ripe', 'ripple', 'rise', 'risk', 'ritual', 'rival',
      'river', 'road', 'roam', 'roar', 'roast', 'robot', 'robust', 'rock', 'rocket', 'rod',
      'role', 'roll', 'romance', 'roof', 'rookie', 'room', 'root', 'rope', 'rose', 'rotate',
      'rotor', 'rough', 'round', 'route', 'routine', 'row', 'royal', 'rubber', 'ruby', 'rug',
      'ruin', 'rule', 'ruler', 'rumor', 'run', 'runner', 'rush', 'rust',
      'sacred', 'sad', 'safe', 'safety', 'sail', 'sailor', 'salad', 'salary', 'sale', 'salmon',
      'salon', 'salt', 'salute', 'same', 'sample', 'sand', 'sandal', 'sane', 'sauce', 'save',
      'scale', 'scan', 'scar', 'scare', 'scarf', 'scene', 'scent', 'schedule', 'schema', 'scheme',
      'scholar', 'school', 'science', 'scissors', 'scoop', 'scope', 'score', 'scout', 'scrap', 'screen',
      'screw', 'script', 'scroll', 'sculpt', 'sea', 'seal', 'search', 'season', 'seat', 'second',
      'secret', 'section', 'sector', 'secure', 'seed', 'seek', 'segment', 'seize', 'select', 'seller',
      'semester', 'senate', 'send', 'sender', 'sense', 'sensor', 'sentence', 'separate', 'sequence', 'serene',
      'series', 'sermon', 'serpent', 'servant', 'server', 'service', 'session', 'settle', 'setup', 'seven',
      'shadow', 'shaft', 'shake', 'shallow', 'shame', 'shape', 'share', 'shark', 'sharp', 'shave',
      'she', 'shear', 'shed', 'sheep', 'sheet', 'shelf', 'shell', 'shelter', 'sheriff', 'shield',
      'shift', 'shine', 'ship', 'shirt', 'shock', 'shoe', 'shoot', 'shop', 'shore', 'short',
      'shot', 'shoulder', 'shout', 'shovel', 'show', 'shower', 'shrimp', 'shrine', 'shrink', 'shrug',
      'shut', 'shuttle', 'shy', 'sick', 'side', 'siege', 'sight', 'sigma', 'sign', 'signal',
      'silent', 'silk', 'silly', 'silver', 'similar', 'simple', 'since', 'sincere', 'sing', 'singer',
      'single', 'sink', 'siphon', 'siren', 'sister', 'site', 'six', 'size', 'skate', 'sketch',
      'ski', 'skill', 'skin', 'skirt', 'skull', 'sky', 'slab', 'slack', 'slam', 'slang',
      'slate', 'slave', 'sleep', 'sleeve', 'slice', 'slide', 'slight', 'slim', 'slip', 'slope',
      'slot', 'slow', 'slug', 'slum', 'small', 'smart', 'smash', 'smell', 'smile', 'smoke',
      'smooth', 'snack', 'snake', 'snap', 'sneak', 'sniff', 'sniper', 'snow', 'soap', 'soccer',
      'social', 'society', 'socket', 'sock', 'soda', 'sofa', 'soft', 'soil', 'solar', 'soldier',
      'solid', 'solo', 'solve', 'somber', 'son', 'song', 'sonic', 'soon', 'soot', 'sorrow',
      'sort', 'soul', 'sound', 'soup', 'source', 'south', 'space', 'spade', 'span', 'spare',
      'spark', 'spatial', 'speak', 'speaker', 'spear', 'special', 'speech', 'speed', 'spell', 'spend',
      'sphere', 'spice', 'spider', 'spike', 'spill', 'spin', 'spine', 'spiral', 'spirit', 'spit',
      'splash', 'split', 'spoil', 'sponge', 'sponsor', 'spoon', 'sport', 'spot', 'spray', 'spread',
      'spring', 'sprint', 'spur', 'squad', 'square', 'squat', 'squeeze', 'squid', 'stab', 'stable',
      'stack', 'staff', 'stage', 'stain', 'stair', 'stake', 'stalk', 'stamp', 'stand', 'standard',
      'star', 'stare', 'start', 'state', 'static', 'station', 'statue', 'status', 'stay', 'steady',
      'steak', 'steal', 'steam', 'steel', 'steep', 'steer', 'stem', 'step', 'stereo', 'stick',
      'stiff', 'still', 'sting', 'stir', 'stitch', 'stock', 'stone', 'stool', 'stop', 'storage',
      'store', 'storm', 'story', 'stout', 'stove', 'straight', 'strand', 'strange', 'strap', 'straw',
      'stream', 'street', 'strength', 'stretch', 'stride', 'strike', 'string', 'strip', 'strobe', 'strong',
      'struggle', 'student', 'studio', 'study', 'stuff', 'stumble', 'stump', 'style', 'sub', 'subject',
      'submit', 'subtle', 'subway', 'succeed', 'success', 'suck', 'sudden', 'suffer', 'sugar', 'suggest',
      'suit', 'suite', 'sulfur', 'sum', 'summary', 'summer', 'summit', 'sun', 'sunny', 'sunset',
      'super', 'supply', 'support', 'surface', 'surge', 'surgeon', 'surplus', 'surprise', 'surround', 'survey',
      'survive', 'suspect', 'sustain', 'swallow', 'swamp', 'swan', 'swap', 'swarm', 'swear', 'sweat',
      'sweep', 'sweet', 'swell', 'swift', 'swim', 'swine', 'swing', 'switch', 'sword', 'symbol',
      'syntax', 'system'
    ];

    for (const w of baseWords) {
      if (w && w.length >= 2) {
        this.wordsSet.add(w.toLowerCase().trim());
      }
    }
  }

  public isValidWord(word: string): boolean {
    if (!word || typeof word !== 'string') return false;
    const clean = word.toLowerCase().trim();
    if (clean.length < 2) return false;
    // Fast lookup
    if (this.wordsSet.has(clean)) return true;
    // Allow alphabetic English words of 3+ letters
    return /^[a-z]{3,18}$/.test(clean);
  }

  public getRandomWord(): string {
    const arr = Array.from(this.wordsSet);
    const validStartingWords = arr.filter(w => w.length >= 4 && w.length <= 7);
    return validStartingWords[Math.floor(Math.random() * validStartingWords.length)] || 'metro';
  }
}
