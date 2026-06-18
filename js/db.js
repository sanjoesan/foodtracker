// db.js — kleine eingebaute Lebensmittel-Datenbank (Nährwerte je 100 g).
// Dient als Offline-Schnellauswahl und funktioniert ohne Internet.
// Werte sind gerundete Durchschnittswerte gängiger Quellen.

/** @typedef {{name:string, brand?:string, basis:'100g', kcal:number, protein:number, carbs:number, fat:number, group:string, pieceWeightG?:number, emoji?:string}} Food */

/** @type {Food[]} */
export const COMMON_FOODS = [
  // Obst
  { name: 'Apfel', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, group: 'Obst', pieceWeightG: 150, emoji: '🍎' },
  { name: 'Banane', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, group: 'Obst', pieceWeightG: 120, emoji: '🍌' },
  { name: 'Orange', kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, group: 'Obst', pieceWeightG: 140, emoji: '🍊' },
  { name: 'Erdbeeren', kcal: 32, protein: 0.7, carbs: 8, fat: 0.3, group: 'Obst', emoji: '🍓' },
  { name: 'Blaubeeren', kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, group: 'Obst', emoji: '🫐' },
  { name: 'Avocado', kcal: 160, protein: 2, carbs: 9, fat: 15, group: 'Obst', pieceWeightG: 170, emoji: '🥑' },

  // Gemüse
  { name: 'Tomate', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, group: 'Gemüse', pieceWeightG: 100, emoji: '🍅' },
  { name: 'Gurke', kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, group: 'Gemüse', emoji: '🥒' },
  { name: 'Karotte', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, group: 'Gemüse', pieceWeightG: 70, emoji: '🥕' },
  { name: 'Brokkoli', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, group: 'Gemüse', emoji: '🥦' },
  { name: 'Kartoffeln (gekocht)', kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, group: 'Gemüse', emoji: '🥔' },
  { name: 'Süßkartoffel', kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, group: 'Gemüse', emoji: '🍠' },
  { name: 'Spinat', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, group: 'Gemüse', emoji: '🥬' },
  { name: 'Paprika', kcal: 31, protein: 1, carbs: 6, fat: 0.3, group: 'Gemüse', pieceWeightG: 120, emoji: '🫑' },

  // Kohlenhydrate
  { name: 'Haferflocken', kcal: 372, protein: 13, carbs: 59, fat: 7, group: 'Getreide', emoji: '🥣' },
  { name: 'Vollkornbrot', kcal: 247, protein: 8, carbs: 41, fat: 4, group: 'Getreide', pieceWeightG: 50, emoji: '🍞' },
  { name: 'Reis (gekocht)', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, group: 'Getreide', emoji: '🍚' },
  { name: 'Nudeln (gekocht)', kcal: 158, protein: 6, carbs: 31, fat: 0.9, group: 'Getreide', emoji: '🍝' },
  { name: 'Quinoa (gekocht)', kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, group: 'Getreide', emoji: '🌾' },

  // Eiweiß
  { name: 'Hähnchenbrust', kcal: 165, protein: 31, carbs: 0, fat: 3.6, group: 'Eiweiß', emoji: '🍗' },
  { name: 'Rindfleisch (mager)', kcal: 187, protein: 26, carbs: 0, fat: 9, group: 'Eiweiß', emoji: '🥩' },
  { name: 'Lachs', kcal: 208, protein: 20, carbs: 0, fat: 13, group: 'Eiweiß', emoji: '🐟' },
  { name: 'Thunfisch (in Wasser)', kcal: 116, protein: 26, carbs: 0, fat: 1, group: 'Eiweiß', emoji: '🐟' },
  { name: 'Ei', kcal: 155, protein: 13, carbs: 1.1, fat: 11, group: 'Eiweiß', pieceWeightG: 60, emoji: '🥚' },
  { name: 'Tofu', kcal: 144, protein: 15, carbs: 3, fat: 9, group: 'Eiweiß', emoji: '🧈' },
  { name: 'Linsen (gekocht)', kcal: 116, protein: 9, carbs: 20, fat: 0.4, group: 'Eiweiß', emoji: '🫘' },
  { name: 'Kichererbsen (gekocht)', kcal: 164, protein: 9, carbs: 27, fat: 2.6, group: 'Eiweiß', emoji: '🫘' },

  // Milchprodukte
  { name: 'Magerquark', kcal: 67, protein: 12, carbs: 4, fat: 0.3, group: 'Milchprodukte', emoji: '🥛' },
  { name: 'Naturjoghurt', kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, group: 'Milchprodukte', emoji: '🥛' },
  { name: 'Skyr', kcal: 63, protein: 11, carbs: 4, fat: 0.2, group: 'Milchprodukte', emoji: '🥛' },
  { name: 'Milch (1,5 %)', kcal: 47, protein: 3.4, carbs: 4.8, fat: 1.5, group: 'Milchprodukte', emoji: '🥛' },
  { name: 'Gouda', kcal: 356, protein: 25, carbs: 2, fat: 28, group: 'Milchprodukte', emoji: '🧀' },

  // Fette & Nüsse
  { name: 'Olivenöl', kcal: 884, protein: 0, carbs: 0, fat: 100, group: 'Fette', emoji: '🫒' },
  { name: 'Butter', kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, group: 'Fette', emoji: '🧈' },
  { name: 'Mandeln', kcal: 579, protein: 21, carbs: 22, fat: 50, group: 'Fette', emoji: '🌰' },
  { name: 'Erdnussbutter', kcal: 588, protein: 25, carbs: 20, fat: 50, group: 'Fette', emoji: '🥜' },

  // Snacks & Sonstiges
  { name: 'Zartbitterschokolade', kcal: 546, protein: 5, carbs: 61, fat: 31, group: 'Snacks', emoji: '🍫' },
  { name: 'Reiswaffel', kcal: 387, protein: 8, carbs: 81, fat: 3, group: 'Snacks', pieceWeightG: 9, emoji: '🍘' },
];

/** Lokale (Offline-)Suche in der eingebauten Datenbank. */
export function searchLocal(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return COMMON_FOODS.filter((f) => f.name.toLowerCase().includes(q)).map((f) => ({
    ...f,
    source: 'local',
  }));
}
