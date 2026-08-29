// MVP3: Fast Trivia — <5 min, 5 Qs, 15s each, multilingual-friendly, Delhi + commute themed
import type { TriviaQuestion } from './types';

export const TRIVIA_BANK: TriviaQuestion[] = [
  {
    id: 't1',
    text: 'Which line is Rajiv Chowk interchange for Blue + Yellow?',
    textHi: 'राजीव चौक किस दो लाइनों का जंक्शन है?',
    options: ['Blue + Yellow', 'Red + Violet', 'Pink + Green', 'Magenta + Orange'],
    correctIndex: 0,
    category: 'Delhi Metro',
    difficulty: 'easy'
  },
  {
    id: 't2',
    text: 'Blue Line goes towards?',
    options: ['Noida / Vaishali', 'Gurugram', 'Ballabhgarh', 'Bahadurgarh'],
    correctIndex: 0,
    category: 'Delhi Metro',
    difficulty: 'easy'
  },
  {
    id: 't3',
    text: 'What to do when doors beep?',
    textHi: 'दरवाज़ा बीप करे तो क्या करें?',
    options: ['Step back, let them close', 'Force them open', 'Hold for friend', 'Push harder'],
    correctIndex: 0,
    category: 'Commute Etiquette',
    difficulty: 'easy'
  },
  {
    id: 't4',
    text: 'Fastest metro card top-up?',
    options: ['QR / app', 'Token queue', 'Cash only', 'Ask stranger'],
    correctIndex: 0,
    category: 'Commute Hack',
    difficulty: 'easy'
  },
  {
    id: 't5',
    text: 'Which station has Botanical Garden interchange?',
    options: ['Botanical Garden', 'Mandi House', 'Kashmere Gate', 'Hauz Khas'],
    correctIndex: 0,
    category: 'Delhi Metro',
    difficulty: 'medium'
  },
  {
    id: 't6',
    text: 'Chai culture: best metro chai size?',
    textHi: 'मेट्रो में चाय?',
    options: ['Kulhad ☕', '1 litre', 'No chai', 'Cold only'],
    correctIndex: 0,
    category: 'Culture',
    difficulty: 'easy'
  },
  {
    id: 't7',
    text: 'Platform to train gap: what to mind?',
    options: ['Mind the gap', 'Jump', 'Run', 'Slide'],
    correctIndex: 0,
    category: 'Safety',
    difficulty: 'easy'
  },
  {
    id: 't8',
    text: 'Yellow Line DU station is?',
    options: ['Vishwavidyalaya', 'Saket', 'Botanical', 'Mayur Vihar'],
    correctIndex: 0,
    category: 'Delhi Metro',
    difficulty: 'easy'
  },
  {
    id: 't9',
    text: 'Best window seat time?',
    textHi: 'खिड़की सीट कब मिलती है?',
    options: ['Off-peak', 'Never', '7am rush', 'Only Monday'],
    correctIndex: 0,
    category: 'Hack',
    difficulty: 'easy'
  },
  {
    id: 't10',
    text: 'Token vs Smart Card — which faster?',
    options: ['Smart Card', 'Token', 'Paper ticket', 'Coin'],
    correctIndex: 0,
    category: 'Delhi Metro',
    difficulty: 'easy'
  },
  {
    id: 't11',
    text: 'If you forget bag, do?',
    options: ['Report to staff', 'Leave it', 'Take home', 'Ignore'],
    correctIndex: 0,
    category: 'Safety',
    difficulty: 'easy'
  },
  {
    id: 't12',
    text: 'Blue line colour code?',
    options: ['Blue #0284c7', 'Red', 'Green', 'Yellow'],
    correctIndex: 0,
    category: 'Delhi Metro',
    difficulty: 'easy'
  }
];

export function pickTriviaSet(count = 5): TriviaQuestion[] {
  const shuffled = [...TRIVIA_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
