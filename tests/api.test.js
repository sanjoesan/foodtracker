// Tests für die Open-Food-Facts-Anbindung mit gemocktem fetch (kein echtes Netzwerk).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchFoods, lookupBarcode, normalize } from '../js/api.js';

function mockFetch(impl) {
  globalThis.fetch = impl;
}

test('searchFoods: Rate-Limit (429) wirft Fehler mit status 429', async () => {
  mockFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
  await assert.rejects(
    () => searchFoods('apfel'),
    (e) => e.status === 429
  );
});

test('searchFoods: nicht-JSON-Antwort (200) ergibt leere Liste statt Fehler', async () => {
  mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error('kein JSON');
    },
  }));
  const r = await searchFoods('apfel');
  assert.deepEqual(r, []);
});

test('searchFoods: filtert Produkte ohne Kalorien heraus', async () => {
  mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      products: [
        { code: '1', product_name: 'Mit kcal', nutriments: { 'energy-kcal_100g': 200, proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 } },
        { code: '2', product_name: 'Ohne kcal', nutriments: {} },
      ],
    }),
  }));
  const r = await searchFoods('x');
  assert.equal(r.length, 1);
  assert.equal(r[0].name, 'Mit kcal');
  assert.equal(r[0].kcal, 200);
});

test('searchFoods: leere Eingabe macht keine Anfrage', async () => {
  let called = false;
  mockFetch(async () => {
    called = true;
    return { ok: true, status: 200, json: async () => ({ products: [] }) };
  });
  const r = await searchFoods('   ');
  assert.deepEqual(r, []);
  assert.equal(called, false);
});

test('searchFoods: respektiert ein bereits abgebrochenes Signal', async () => {
  mockFetch(async (_url, opts) => {
    // fetch wirft bei abgebrochenem Signal einen AbortError (wie im Browser).
    if (opts && opts.signal && opts.signal.aborted) {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }
    return { ok: true, status: 200, json: async () => ({ products: [] }) };
  });
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(() => searchFoods('apfel', { signal: ac.signal }), (e) => e.name === 'AbortError');
});

test('lookupBarcode: unbekanntes Produkt (status 0) ergibt null', async () => {
  mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ status: 0 }) }));
  const r = await lookupBarcode('0000000000000');
  assert.equal(r, null);
});

test('normalize: rechnet kJ in kcal um, wenn kcal fehlt', () => {
  const f = normalize({ code: '1', product_name: 'X', nutriments: { energy_100g: 418.4 } });
  assert.equal(f.kcal, Math.round(418.4 / 4.184)); // ≈ 100
});
