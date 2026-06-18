// db.js — Offline-Suche über die eingebaute Lebensmittel-Datenbank.
// Die Daten liegen in foods-data.js (~1180 recherchierte Einträge, Nährwerte je 100 g/ml).

import { FOODS } from './foods-data.js';

export { FOODS };

/** Klein schreiben, Akzente/Umlaute vereinheitlichen für tolerante Suche. */
function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diakritische Zeichen entfernen (ä→a …)
    .replace(/ß/g, 'ss');
}

// Suchindex einmalig vorberechnen (Name + Gruppe, normalisiert).
const INDEX = FOODS.map((f) => ({
  food: f,
  n: normalize(f.name),
  hay: normalize(f.name + ' ' + (f.group || '')),
}));

/**
 * Tolerante Offline-Suche. Alle Suchbegriffe müssen vorkommen (UND-Verknüpfung).
 * Treffer am Wortanfang werden höher gewichtet.
 * @returns Array von Lebensmitteln im einheitlichen Format (basis '100g').
 */
export function searchLocal(query, limit = 60) {
  const q = normalize(String(query).trim());
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const scored = [];
  for (const entry of INDEX) {
    if (!terms.every((t) => entry.hay.includes(t))) continue;
    let score;
    if (entry.n.startsWith(q)) score = 4;
    else if (entry.n.includes(' ' + q) || entry.n.includes('(' + q)) score = 3;
    else if (entry.n.includes(q)) score = 2;
    else score = 1; // Treffer nur über die Gruppe
    scored.push({ entry, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.entry.food.name.length - b.entry.food.name.length || a.entry.food.name.localeCompare(b.entry.food.name, 'de')
  );

  return scored.slice(0, limit).map(({ entry }) => ({ ...entry.food, source: 'local', basis: '100g' }));
}
