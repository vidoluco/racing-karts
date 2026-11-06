// The eleven items. Effects live in sim/items.js; the numbers the design fixes are here so sim, HUD and tests read one value.
// What a box gives is uniform: no odds by place, for humans and bots alike, from the sim's seeded rng.

export const ITEMS = [
  { id: 'razzo', name: { it: 'Razzo', en: 'Rocket' }, charges: 1, desc: { it: 'Vola lungo la strada e insegue il kart davanti a te. Da primo, spazza tutta la strada e per 3 secondi niente ti tocca.', en: 'Flies along the road and homes on the kart ahead of you. From first place it sweeps the whole road and nothing touches you for 3 seconds.' } },
  { id: 'grappa', name: { it: 'Grappa', en: 'Grappa' }, charges: 1, boostT: 2.6, tipsyT: 1.5, desc: { it: 'Una gran spinta, poi un po\' di sbandamento.', en: 'A big boost, then a little wobble.' } },
  { id: 'zuica', name: { it: 'Țuică', en: 'Țuică' }, charges: 3, boostT: 1.1, desc: { it: 'Tre sorsi, una spinta breve per ogni sorso.', en: 'Three sips, a short boost for each.' } },
  { id: 'mici', name: { it: 'Mici', en: 'Mici' }, charges: 3, desc: { it: 'Tre salsicce in orbita parano i colpi; premi per lanciarne una. Da primo la lanci indietro, su chi ti insegue.', en: 'Three orbiting sausages block hits; press to throw one. From first it goes back, at the chasers.' } },
  { id: 'uova', name: { it: 'Uova, speck e patate', en: 'Eggs, speck and potatoes' }, charges: 1, bigT: 5, desc: { it: 'La padella sfrigola: cresci, voli e travolgi tutti per 5 secondi.', en: 'The pan sizzles: for 5 seconds you grow, you fly and you bowl everyone over.' } },
  { id: 'polenta', aim: true, name: { it: 'Polenta', en: 'Polenta' }, nameRomania: { it: 'Mămăligă', en: 'Mămăligă' }, charges: 1, desc: { it: 'Una pozza appiccicosa dietro di te, o lontano davanti con la levetta in su o se dietro non hai nessuno.', en: 'A sticky puddle behind you, or far ahead with the stick up or with nobody behind.' } },
  { id: 'formaggio', aim: true, name: { it: 'Forma di Formaggio', en: 'Cheese Wheel' }, charges: 1, desc: { it: 'Rotola indietro lungo la strada e travolge chi insegue; con la levetta in su o se dietro non hai nessuno, rotola avanti, verso il kart che hai davanti.', en: 'Rolls back down the road and bowls over the chasers; with the stick up or with nobody behind it rolls ahead, at the kart in front.' } },
  { id: 'durian', aim: true, name: { it: 'Durian', en: 'Durian' }, charges: 1, ttl: 7, desc: { it: 'Una nuvola di puzza dietro di te per 7 secondi, o in testa al gruppo con la levetta in su o se dietro non hai nessuno.', en: 'A stink cloud behind you for 7 seconds, or onto the leaders with the stick up or with nobody behind.' } },
  { id: 'sambal', name: { it: 'Sambal', en: 'Sambal' }, charges: 1, boostT: 3, desc: { it: 'Una fiammata enorme all\'indietro, poi 3 secondi di spinta e una scia di fuoco.', en: 'A huge flame blast backward, then a 3 second boost and a trail of fire.' } },
  { id: 'rendang', name: { it: 'Rendang', en: 'Rendang' }, charges: 1, t: 4, desc: { it: 'Un profumo irresistibile ti trascina dal kart davanti: al contatto gli rubi l\'oggetto. Da primo, attira le casse.', en: 'A smell nobody resists drags you to the kart ahead: on contact you steal its item. From first place it pulls in the crates.' } },
  { id: 'frana', name: { it: 'Frana', en: 'Landslide' }, charges: 1, desc: { it: 'Una frana cade davanti al primo e lascia massi da schivare. Da primo, cade sul secondo.', en: 'A landslide drops in front of the leader and leaves rocks to dodge. From first place it falls on the second.' } },
];

export const ITEM_IDS = ITEMS.map((i) => i.id);
export const itemInfo = (id) => ITEMS.find((i) => i.id === id) || null;
export const itemName = (id, lang = 'it', region = null) => {
  const it = itemInfo(id);
  return (region === 'romania' && it.nameRomania ? it.nameRomania : it.name)[lang] ?? it.name.en;
};

export const BOX_RESPAWN = 3;   // s
export const ROULETTE_T = 1.2;  // s

// r in [0, 1) comes from the sim's seeded rng, so a roll stays deterministic.
export const rollItem = (r) => ITEM_IDS[Math.min(ITEM_IDS.length - 1, Math.floor(r * ITEM_IDS.length))];
