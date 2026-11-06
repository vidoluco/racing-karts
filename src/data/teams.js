// The two sides of a team championship, pure data shared by the TV, the phone and the flow. A chilli from Java against the
// gentian of the Dolomites: red and blue, so the two read apart at a glance, on a map dot and for colour-blind eyes too.
export const TEAMS = [
  { id: 'a', color: '#ee5236', light: '#ffc4b2', dark: '#a82f18', glow: '238, 82, 54', names: { it: 'Sambal', en: 'Sambal' } },
  { id: 'b', color: '#2f6fe8', light: '#bcd3ff', dark: '#1b429a', glow: '47, 111, 232', names: { it: 'Genziana', en: 'Gentian' } },
];
export const TEAM_IDS = TEAMS.map((t) => t.id);
export const TEAM_SIZE = 2;
// a bot racing for nobody: pale on the map, so that the eye counts only the two sides
export const NEUTRAL_COLOR = '#d6d0c4';

export const teamInfo = (id) => TEAMS.find((t) => t.id === id) || null;
export const teamName = (id, lang) => { const n = teamInfo(id)?.names; return n?.[lang] ?? n?.en ?? ''; };
