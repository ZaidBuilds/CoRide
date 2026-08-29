// 20 Questions — curated secrets with tags for bot yes/no answers (low moderation risk)
export interface SecretDef {
  word: string;
  category: string; // Food | Place | Object | Delhi
  hint: string;
  tags: Record<string, boolean | string>;
}

export const SECRETS: SecretDef[] = [
  {
    word: 'Samosa',
    category: 'Food',
    hint: 'Delhi station snack • Food',
    tags: { isFood: true, isPlace: false, isMoving: false, isHot: true, isVeg: true, color: 'golden', startsWith: 'S', isSweet: false }
  },
  {
    word: 'Metro Token',
    category: 'Object',
    hint: 'You tap it to travel • Object',
    tags: { isFood: false, isPlace: false, isMoving: false, isHot: false, isTicket: true, color: 'red', startsWith: 'M' }
  },
  {
    word: 'Rajiv Chowk',
    category: 'Place',
    hint: 'Busiest interchange • Place',
    tags: { isFood: false, isPlace: true, isMoving: false, isHot: false, color: '', startsWith: 'R', isInterchange: true }
  },
  {
    word: 'Chai Kulhad',
    category: 'Food',
    hint: 'Clay cup tea • Food',
    tags: { isFood: true, isPlace: false, isMoving: false, isHot: true, isVeg: true, color: 'brown', startsWith: 'C' }
  },
  {
    word: 'Qutub Minar',
    category: 'Delhi',
    hint: 'Tall minaret • Delhi',
    tags: { isFood: false, isPlace: true, isMoving: false, isHot: false, isHistoric: true, color: 'sand', startsWith: 'Q' }
  },
  {
    word: 'Headphones',
    category: 'Object',
    hint: 'Commute buddy • Object',
    tags: { isFood: false, isPlace: false, isMoving: false, isHot: false, isMusic: true, color: 'black', startsWith: 'H' }
  },
  {
    word: 'Lotus Temple',
    category: 'Delhi',
    hint: 'Flower-shaped temple • Place',
    tags: { isFood: false, isPlace: true, isMoving: false, isHot: false, isHistoric: false, color: 'white', startsWith: 'L' }
  },
  {
    word: 'Auto Rickshaw',
    category: 'Object',
    hint: 'Last-mile ride • Object',
    tags: { isFood: false, isPlace: false, isMoving: true, isHot: false, color: 'green', startsWith: 'A' }
  },
  {
    word: 'Biryani',
    category: 'Food',
    hint: 'Hyderabadi love • Food',
    tags: { isFood: true, isPlace: false, isMoving: false, isHot: true, isVeg: false, color: 'yellow', startsWith: 'B' }
  },
  {
    word: 'Yamuna Bank',
    category: 'Place',
    hint: 'Blue line junction • Place',
    tags: { isFood: false, isPlace: true, isMoving: false, isHot: false, color: '', startsWith: 'Y', isInterchange: true }
  },
  {
    word: 'Power Bank',
    category: 'Object',
    hint: 'Phone saver • Object',
    tags: { isFood: false, isPlace: false, isMoving: false, isHot: false, isElectric: true, color: '', startsWith: 'P' }
  },
  {
    word: 'Paratha',
    category: 'Food',
    hint: 'Morning fuel • Food',
    tags: { isFood: true, isPlace: false, isMoving: false, isHot: true, isVeg: true, color: 'golden', startsWith: 'P' }
  }
];

export function pickSecret(): SecretDef {
  return SECRETS[Math.floor(Math.random() * SECRETS.length)];
}

// Simple rule-based yes/no for common question phrasing (MVP — no LLM)
export function answerQuestion(secret: SecretDef, question: string): 'yes' | 'no' | 'maybe' {
  const q = question.toLowerCase();
  const w = secret.word.toLowerCase();
  const t: any = secret.tags;

  // direct guesses handled outside — here only yes/no questions
  if (q.includes(w)) return 'yes';

  // category checks
  if (q.includes('food') || q.includes('eat') || q.includes('khana')) return t.isFood ? 'yes' : 'no';
  if (q.includes('place') || q.includes('station') || q.includes('delhi') || q.includes('jagah')) return t.isPlace ? 'yes' : 'no';
  if (q.includes('move') || q.includes('moving') || q.includes('chal')) return t.isMoving ? 'yes' : 'no';
  if (q.includes('hot') || q.includes('garam')) return t.isHot ? 'yes' : 'no';
  if (q.includes('cold') || q.includes('thanda')) return t.isHot ? 'no' : 'yes';
  if (q.includes('veg') || q.includes('vegetarian')) return t.isVeg ? 'yes' : t.isVeg === undefined ? 'maybe' : 'no';
  if (q.includes('sweet') || q.includes('meetha')) return t.isSweet ? 'yes' : t.isSweet === undefined ? 'maybe' : 'no';
  if (q.includes('historic') || q.includes('purana')) return t.isHistoric ? 'yes' : t.isHistoric === undefined ? 'maybe' : 'no';
  if (q.includes('color') || q.includes('rang')) {
    for (const c of ['red','golden','brown','white','black','green','yellow','sand']) {
      if (q.includes(c) && t.color === c) return 'yes';
      if (q.includes(c) && t.color !== c && t.color) return 'no';
    }
    return 'maybe';
  }
  if (q.includes('start with') || q.includes('first letter')) {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      if (q.includes(`'${ch}'`) || q.includes(` ${ch} `) || q.includes(`letter ${ch}`)) {
        return (t.startsWith || '').toLowerCase() === ch ? 'yes' : 'no';
      }
    }
    // fallback: check if question mentions starting letter equals secret's first
    if (q.includes((t.startsWith || '').toLowerCase())) return 'yes';
    return 'maybe';
  }
  if (q.includes('interchange') || q.includes('junction')) return t.isInterchange ? 'yes' : 'no';
  if (q.includes('ticket') || q.includes('token')) return t.isTicket ? 'yes' : 'no';
  if (q.includes('music') || q.includes('song') || q.includes('headphone')) return t.isMusic ? 'yes' : 'no';
  if (q.includes('electric') || q.includes('charge')) return t.isElectric ? 'yes' : 'no';

  // generic length
  if (q.includes('long') && w.length > 7) return 'yes';
  if (q.includes('short') && w.length <= 5) return 'yes';
  if (q.includes('long') && w.length <= 5) return 'no';
  if (q.includes('short') && w.length > 7) return 'no';

  return 'maybe';
}
