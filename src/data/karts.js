// The nine karts. Stats run 1..5 and sum to 15, so no kart is strictly best; sim/tuning.js maps them to physics.
// pitch scales the gibberish voice of the driver: small animals high, the bear low.

export const KARTS = [
  {
    id: 'tabia', region: 'cadore', name: 'Il Tabià', color: '#a8703a', accent: '#d9463d',
    stats: { speed: 3, accel: 3, handling: 3, weight: 3, offroad: 3 },
    driver: { name: 'Bepi', species: { it: 'la marmotta', en: 'the marmot' }, pitch: 1.2, line: { it: 'Porta il fieno a casa prima di sera, costi quel che costi.', en: 'The hay gets home before dark, whatever it takes.' } },
    concept: { it: 'Un piccolo fienile di larice su ruote, con i gerani alla finestra.', en: 'A little larch barn on wheels, geraniums at the window.' },
  },
  {
    id: 'gatto', region: 'cadore', name: 'Gatto delle Nevi', color: '#d8362e', accent: '#f4f1e8',
    stats: { speed: 2, accel: 2, handling: 2, weight: 5, offroad: 4 },
    driver: { name: 'Toni', species: { it: 'il camoscio', en: 'the chamois' }, pitch: 1.0, line: { it: 'Dove passa lui, la pista resta pettinata.', en: 'Where he goes, the piste stays combed.' } },
    concept: { it: 'Un battipista rosso e paffuto, con la lama davanti e la fresa dietro.', en: 'A chubby red piste groomer, blade in front and tiller behind.' },
  },
  {
    id: 'seggiovia', region: 'cadore', name: 'Seggiovia', color: '#3f8fd0', accent: '#f2c531',
    stats: { speed: 4, accel: 3, handling: 4, weight: 1, offroad: 3 },
    driver: { name: 'Nane', species: { it: 'lo stambecco', en: 'the ibex' }, pitch: 0.95, line: { it: 'Tiene sempre la sbarra abbassata. Quasi sempre.', en: 'Always keeps the safety bar down. Nearly always.' } },
    concept: { it: 'Una seggiola biposto su un telaio da kart, con la grande puleggia dietro.', en: 'A two-seat chairlift chair on a kart frame, the big bullwheel behind.' },
  },
  {
    id: 'mocanita', region: 'romania', name: 'Mocănița', color: '#3a3a44', accent: '#cc3a2f',
    stats: { speed: 5, accel: 1, handling: 2, weight: 5, offroad: 2 },
    driver: { name: 'Ursu', species: { it: "l'orso dei Carpazi", en: 'the Carpathian bear' }, pitch: 0.65, line: { it: 'Parte con calma, ma poi chi lo ferma più?', en: 'Slow to get going, and then who could stop him?' } },
    concept: { it: 'La piccola locomotiva a vapore nera e rossa della valle del Vaser, in Maramureș.', en: 'The little black and red steam loco of the Vaser valley in Maramureș.' },
  },
  {
    id: 'caruta', region: 'romania', name: 'Căruța', color: '#e0a02c', accent: '#2b6fb8',
    stats: { speed: 2, accel: 4, handling: 3, weight: 2, offroad: 4 },
    driver: { name: 'Oița', species: { it: 'la pecora', en: 'the sheep' }, pitch: 1.35, line: { it: 'Nessuna strada è troppo brutta per un carro ben dipinto.', en: 'No road is too rough for a well painted cart.' } },
    concept: { it: 'Un carro di legno dipinto con motivi popolari romeni e un mucchio di fieno, tirato da un cavallo paffuto.', en: 'A wooden cart painted with Romanian folk motifs and a heap of hay, pulled by a plump horse.' },
  },
  {
    id: 'logan', region: 'romania', name: 'Logan Vecchia', color: '#dcc994', accent: '#3d78b8',
    stats: { speed: 4, accel: 2, handling: 3, weight: 4, offroad: 2 },
    driver: { name: 'Vlăduț', species: { it: 'il pipistrello', en: 'the bat' }, pitch: 1.5, line: { it: 'Una portiera di un altro colore, il nastro sul paraurti e una fede incrollabile.', en: 'A door of another colour, tape on the bumper and unshakeable faith.' } },
    concept: { it: 'Una Logan vecchissima, ammaccata e paffuta, con i sacchi sul portapacchi e uno scarico che si sente da Brașov.', en: 'A very old, battered and chubby Logan, sacks on the roof rack and an exhaust they can hear in Brașov.' },
  },
  {
    id: 'jeep', region: 'indonesia', name: 'Bromo 4x4', color: '#6f9a8d', accent: '#e4cfa0',
    stats: { speed: 3, accel: 2, handling: 2, weight: 3, offroad: 5 },
    driver: { name: 'Budi', species: { it: 'il macaco', en: 'the macaque' }, pitch: 1.25, line: { it: 'Conosce ogni duna del mare di sabbia, anche al buio.', en: 'Knows every dune of the sand sea, even in the dark.' } },
    concept: { it: 'Una vecchia 4x4 da turisti scolorita dal sole, con portapacchi e ruota di scorta.', en: 'An old sun faded tourist 4x4, roof rack and spare wheel.' },
  },
  {
    id: 'becak', region: 'indonesia', name: 'Becak', color: '#e0476b', accent: '#37b6b0',
    stats: { speed: 2, accel: 5, handling: 4, weight: 1, offroad: 3 },
    driver: { name: 'Tokek', species: { it: 'il geco', en: 'the gecko' }, pitch: 1.6, line: { it: 'Pedala come un matto e suona il campanello a tutti.', en: 'Pedals like mad and rings the bell at everybody.' } },
    concept: { it: 'Il taxi a pedali di Giava, con la cappotta dipinta e un campanello.', en: 'The pedal cab of Java, a painted canopy and a bell.' },
  },
  {
    id: 'jukung', region: 'indonesia', name: 'Jukung', color: '#2a8fc4', accent: '#f06b3c',
    stats: { speed: 4, accel: 3, handling: 4, weight: 2, offroad: 2 },
    driver: { name: 'Komo', species: { it: 'il drago di Komodo', en: 'the Komodo dragon' }, pitch: 0.8, line: { it: 'Lontano dal mare, ma con il vento in poppa.', en: 'Far from the sea, but with a following wind.' } },
    concept: { it: 'Una barca da pesca balinese su ruote, con gli occhi dipinti a prua e i galleggianti di bambù.', en: 'A Balinese outrigger on wheels, painted eyes on the prow and bamboo floats.' },
  },
];

export const KART_IDS = KARTS.map((k) => k.id);

// The family, kept apart: bots and every list of "the karts" never see them; a player does once a won Gran Premio opens them (src/game/unlocks.js).
// bites: the sim's src/sim/bite.js snaps at whoever stays too close.
export const SECRET_KARTS = [
  {
    id: 'baileys', region: 'romania', name: 'La Cuccia', color: '#3fa7a0', accent: '#e8505b', secret: true, bites: true,
    stats: { speed: 3, accel: 4, handling: 3, weight: 2, offroad: 3 },
    driver: { name: 'Baileys', species: { it: 'il gatto', en: 'the cat' }, pitch: 1.45, line: { it: 'Tutto fusa e coccole. Però tu non avvicinarti troppo.', en: 'All purrs and cuddles. Just do not come too close.' } },
    concept: { it: 'Una cuccia di legno su ruote, con il tetto rosso, la coda che esce dalla porta e un morso per chi si fa troppo vicino.', en: 'A wooden kennel on wheels, red roof, tail out of the door and a bite for whoever comes too close.' },
  },
  {
    id: 'fifi', region: 'indonesia', name: 'Il Carrello', color: '#d9763c', accent: '#f4f1e8', secret: true,
    stats: { speed: 4, accel: 3, handling: 2, weight: 4, offroad: 2 },
    driver: { name: 'Fifi', species: { it: 'la chef', en: 'the chef' }, pitch: 1.3, line: { it: 'La cena arriva in tavola calda, a qualunque velocità.', en: 'Dinner reaches the table hot, at any speed.' } },
    concept: { it: 'Un carrello da cucina in acciaio con le padelle di rame che dondolano e la pentola sempre sul fuoco.', en: 'A steel kitchen trolley, copper pans swinging and the pot always on the go.' },
  },
];
export const SECRET_IDS = SECRET_KARTS.map((k) => k.id);
export const ROSTER = [...KARTS, ...SECRET_KARTS];
export const kartInfo = (id) => ROSTER.find((k) => k.id === id) || null;
