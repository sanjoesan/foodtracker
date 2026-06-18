// api.js — Anbindung an Open Food Facts (https://world.openfoodfacts.org),
// die bekannte, freie und offene Lebensmittel-Datenbank.
// Unterstützt Barcode-Lookup und Volltextsuche. Funktioniert per CORS direkt im Browser.

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'generic_name',
  'brands',
  'nutriments',
  'serving_size',
  'quantity',
  'image_front_small_url',
  'nutriscore_grade',
].join(',');

/** kJ → kcal, falls kcal-Wert fehlt. */
function toKcal(nutr) {
  if (nutr['energy-kcal_100g'] != null) return Number(nutr['energy-kcal_100g']);
  if (nutr['energy-kcal'] != null) return Number(nutr['energy-kcal']);
  if (nutr['energy_100g'] != null) return Number(nutr['energy_100g']) / 4.184; // kJ
  return 0;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Serviergröße wie "30 g" oder "250ml" in Gramm/ml parsen. */
function parseServing(str) {
  if (!str) return null;
  const m = String(str).match(/([\d.,]+)\s*(g|ml)/i);
  if (!m) return null;
  const val = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(val) ? val : null;
}

/** OFF-Produkt in unser einheitliches Lebensmittel-Format überführen. */
export function normalize(p) {
  if (!p) return null;
  const nutr = p.nutriments || {};
  const name =
    p.product_name_de || p.product_name || p.generic_name || 'Unbenanntes Produkt';
  return {
    source: 'off',
    barcode: p.code || null,
    name: name.trim(),
    brand: (p.brands || '').split(',')[0].trim() || '',
    basis: '100g', // alle Nährwerte beziehen sich auf 100 g/ml
    kcal: Math.round(toKcal(nutr)),
    protein: +num(nutr.proteins_100g).toFixed(1),
    carbs: +num(nutr.carbohydrates_100g).toFixed(1),
    fat: +num(nutr.fat_100g).toFixed(1),
    sugar: +num(nutr.sugars_100g).toFixed(1),
    fiber: +num(nutr.fiber_100g).toFixed(1),
    salt: +num(nutr.salt_100g).toFixed(2),
    servingG: parseServing(p.serving_size),
    nutriscore: p.nutriscore_grade && p.nutriscore_grade !== 'unknown' ? p.nutriscore_grade : null,
    image: p.image_front_small_url || null,
  };
}

async function fetchJSON(url, { timeout = 12000, tolerantParse = false } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // echter Serverfehler
    if (tolerantParse) {
      // Unverständliche Antwort → null (= "keine Treffer"), kein harter Fehler.
      try {
        return await res.json();
      } catch {
        return null;
      }
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Produkt per Barcode (EAN/UPC) abrufen.
 * @returns normalisiertes Lebensmittel oder null, wenn unbekannt.
 */
export async function lookupBarcode(barcode) {
  const code = String(barcode).replace(/\D/g, '');
  if (!code) return null;
  const url = `${BASE}/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`;
  const data = await fetchJSON(url);
  if (!data || data.status === 0 || !data.product) return null;
  const food = normalize(data.product);
  // Produkte ganz ohne Kalorienangabe sind für uns nutzlos.
  if (!food || (!food.kcal && !food.protein && !food.carbs && !food.fat)) return food; // trotzdem zurückgeben, UI warnt
  return food;
}

/**
 * Volltextsuche.
 * @returns Array normalisierter Lebensmittel (mit Nährwerten, nach Relevanz).
 */
export async function searchFoods(query, { pageSize = 24 } = {}) {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    fields: FIELDS,
  });
  const url = `${BASE}/cgi/search.pl?${params.toString()}`;
  // tolerantParse: leere/seltsame Antworten gelten als "keine Treffer",
  // nur echte Netzwerk-/Serverfehler werfen (→ UI: "nicht erreichbar").
  const data = await fetchJSON(url, { timeout: 15000, tolerantParse: true });
  const products = data && Array.isArray(data.products) ? data.products : [];
  return products
    .map(normalize)
    .filter((f) => f && f.kcal > 0) // nur Treffer mit echten Nährwerten
    .slice(0, pageSize);
}
