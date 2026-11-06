import { antelao, pelmo } from './cadore.js';
import { transfagarasan, bran } from './romania.js';
import { bromo, bali } from './indonesia.js';
import { jakarta } from './jakarta.js';
import { menu, results, podium } from './menu.js';

export const TUNES = { antelao, pelmo, transfagarasan, bran, bromo, bali, jakarta, menu, results, podium };
export const LOOPING = ['antelao', 'pelmo', 'transfagarasan', 'bran', 'bromo', 'bali', 'jakarta', 'menu'];
// A track definition may name its region: each region's first track stands for it.
export const REGION = { cadore: 'antelao', romania: 'transfagarasan', indonesia: 'bromo' };

export function resolveTune(ref) {
  // a track id, a screen, a region, or the track object itself: the callers should not have to care
  const name = typeof ref === 'string' ? ref : ref?.id ?? ref?.def?.id;
  if (!name) return null;
  if (TUNES[name]) return TUNES[name];
  if (REGION[name]) return TUNES[REGION[name]];
  return null;
}
