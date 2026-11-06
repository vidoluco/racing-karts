// The six tracks in Gran Premio order. Their defs load lazily: the template import below is what lets a track file
// be missing, esbuild bundles whatever matches tracks/*.js and the rest only fails if someone asks for it.

export const TRACKS = [
  { id: 'antelao', region: 'cadore', names: { it: "Giro dell'Antelao", en: 'Antelao Loop' }, regionNames: { it: 'Cadore', en: 'Cadore' } },
  { id: 'pelmo', region: 'cadore', names: { it: "Pelmo d'Inverno", en: 'Pelmo in Winter' }, regionNames: { it: 'Cadore', en: 'Cadore' } },
  { id: 'transfagarasan', region: 'romania', names: { it: 'Transfăgărășan', en: 'Transfăgărășan' }, regionNames: { it: 'Romania', en: 'Romania' } },
  { id: 'bran', region: 'romania', names: { it: 'Bran sotto la Luna', en: 'Bran under the Moon' }, regionNames: { it: 'Romania', en: 'Romania' } },
  { id: 'bromo', region: 'indonesia', names: { it: 'Mare di Sabbia', en: 'Sea of Sand' }, regionNames: { it: 'Indonesia', en: 'Indonesia' } },
  { id: 'bali', region: 'indonesia', names: { it: 'Terrazze di Bali', en: 'Bali Terraces' }, regionNames: { it: 'Indonesia', en: 'Indonesia' } },
  { id: 'jakarta', region: 'indonesia', names: { it: 'Jakarta Macet', en: 'Jakarta Gridlock' }, regionNames: { it: 'Indonesia', en: 'Indonesia' } },
  { id: 'batur', region: 'indonesia', names: { it: 'Dal Mare al Batur', en: 'Sea to Batur' }, regionNames: { it: 'Indonesia', en: 'Indonesia' } },
  { id: 'cortina', region: 'cadore', names: { it: 'Cortina e il Giau', en: 'Cortina and the Giau' }, regionNames: { it: 'Cadore', en: 'Cadore' } },
  { id: 'bucarest', region: 'romania', names: { it: "Bucarest Sera d'Oro", en: 'Bucharest Golden Evening' }, regionNames: { it: 'Romania', en: 'Romania' } },
];

export const TRACK_IDS = TRACKS.map((t) => t.id);
export const trackInfo = (id) => TRACKS.find((t) => t.id === id) || null;

export async function loadTrackDef(id) {
  if (!trackInfo(id)) throw new Error(`unknown track: ${id}`);
  const mod = await import(`../world/tracks/${id}.js`);
  return mod.default;
}
