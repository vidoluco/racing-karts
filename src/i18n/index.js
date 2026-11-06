// One dictionary per language for the TV's screens; en.js and it.js have the same keys and no visible string lives in the
// code. The phone has its own in controller/i18n.js.
import { en } from './en.js';
import { it } from './it.js';

export { en, it };
export const LANGS = ['it', 'en'];
export const DICTS = { it, en };
export const LANG_KEY = 'racing-karts.lang';

// Stored choice first, then the browser language: it* -> Italian, anything else -> English.
export function pickLang(stored, navLang) {
  if (LANGS.includes(stored)) return stored;
  return /^it\b/i.test(navLang || '') ? 'it' : 'en';
}

export function detectLang(storage = globalThis.localStorage, nav = globalThis.navigator) {
  let stored = null;
  try { stored = storage?.getItem(LANG_KEY) ?? null; } catch {}
  return pickLang(stored, nav?.language);
}

export function saveLang(lang, storage = globalThis.localStorage) {
  try { storage?.setItem(LANG_KEY, lang); } catch {}
}

export function translator(lang) {
  const d = DICTS[lang] || en;
  return (key, vars) => {
    let s = d[key] ?? en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return s;
  };
}

// 1° / 2° in Italian, 1st / 2nd in English. [number, suffix], so a screen can raise the suffix.
export function ordinal(lang, n) {
  if (lang === 'it') return [String(n), '°'];
  const s = { one: 'st', two: 'nd', few: 'rd', other: 'th' }[new Intl.PluralRules('en', { type: 'ordinal' }).select(n)];
  return [String(n), s];
}

// Race time as m:ss.cc (m:ss,cc in Italian). Negative or missing times return ''.
export function formatTime(lang, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const cs = Math.round(seconds * 100);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}${lang === 'it' ? ',' : '.'}${String(c).padStart(2, '0')}`;
}

// The difference from a record, with its sign: -0.31 is ahead of it. Missing returns ''.
export function formatDelta(lang, seconds) {
  if (!Number.isFinite(seconds)) return '';
  const gap = formatGap(lang, Math.abs(seconds));
  return seconds < 0 ? gap.replace('+', '-') : gap;
}

// A gap as +12.34 or +1:02.50, the separator by language.
export function formatGap(lang, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const sep = lang === 'it' ? ',' : '.';
  const cs = Math.round(seconds * 100);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = String(cs % 100).padStart(2, '0');
  return m ? `+${m}:${String(s).padStart(2, '0')}${sep}${c}` : `+${s}${sep}${c}`;
}

// A label of the data files, {it, en} or a plain string.
export function pickLabel(lang, label) {
  if (label && typeof label === 'object') return label[lang] ?? label.en ?? Object.values(label)[0] ?? '';
  return label == null ? '' : String(label);
}
