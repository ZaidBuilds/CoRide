// Simple collaborative prompts — <5 min, low moderation risk, multilingual-friendly
import type { PromptCard } from './types';

export const PROMPTS: PromptCard[] = [
  { id: 'p1', text: 'Describe your commute in 3 words', textHi: 'अपनी यात्रा 3 शब्दों में बताओ', emoji: '🚇', category: 'commute' },
  { id: 'p2', text: 'Window or Aisle?', textHi: 'खिड़की या गलियारा?', emoji: '🪟', category: 'this_or_that' },
  { id: 'p3', text: 'Best chai spot near your station?', textHi: 'स्टेशन के पास बेस्ट चाय?', emoji: '☕', category: 'commute' },
  { id: 'p4', text: 'Chai or Coffee for metro?', textHi: 'चाय या कॉफी?', emoji: '☕', category: 'this_or_that' },
  { id: 'p5', text: 'One hidden gem station?', textHi: 'कोई छुपा हुआ स्टेशन?', emoji: '📍', category: 'commute' },
  { id: 'p6', text: 'Would you rather: Silence or Playlist?', textHi: 'शांत या गाने?', emoji: '🎧', category: 'would_you_rather' },
  { id: 'p7', text: 'Go-to metro timepass?', textHi: 'मेट्रो में टाइमपास?', emoji: '🎮', category: 'icebreaker' },
  { id: 'p8', text: 'Share a 1-line travel tip', textHi: 'एक यात्रा टिप', emoji: '💡', category: 'commute' },
  { id: 'p9', text: 'Morning or Evening metro?', textHi: 'सुबह या शाम?', emoji: '🌅', category: 'this_or_that' },
  { id: 'p10', text: 'If your commute was a song?', textHi: 'यात्रा एक गाना हो तो?', emoji: '🎶', category: 'icebreaker' },
  { id: 'p11', text: 'Pick: Street food or Café?', textHi: 'स्ट्रीट फूड या कैफे?', emoji: '🥘', category: 'this_or_that' },
  { id: 'p12', text: 'One word for Delhi today', textHi: 'आज दिल्ली एक शब्द में', emoji: '🏙️', category: 'icebreaker' }
];

export function pickPrompt(): PromptCard {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}
export function pickPrompts(n = 3): PromptCard[] {
  const sh = [...PROMPTS].sort(() => Math.random() - 0.5);
  return sh.slice(0, n);
}
