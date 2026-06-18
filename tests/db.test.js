// Tests für die Offline-Lebensmittel-Datenbank und die lokale Suche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLocal, FOODS } from '../js/db.js';

test('FOODS enthält eine große, recherchierte Liste', () => {
  assert.ok(FOODS.length > 800, `nur ${FOODS.length} Einträge`);
});

test('Jeder Eintrag hat gültige Pflichtfelder', () => {
  for (const f of FOODS) {
    assert.equal(typeof f.name, 'string');
    assert.ok(f.name.trim().length > 0);
    assert.equal(typeof f.group, 'string');
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) {
      assert.ok(Number.isFinite(f[k]) && f[k] >= 0, `${f.name}: ${k}=${f[k]}`);
    }
  }
});

test('Keine doppelten Namen', () => {
  const seen = new Set();
  for (const f of FOODS) {
    const key = f.name.toLowerCase().trim();
    assert.equal(seen.has(key), false, `Duplikat: ${f.name}`);
    seen.add(key);
  }
});

test('Nährwerte sind plausibel (kcal ≈ 4·EW + 4·KH + 9·Fett)', () => {
  // Getränke (Alkohol) ausgenommen; sonst Abweichung höchstens 40 %.
  for (const f of FOODS) {
    if (/getränke/i.test(f.group) || f.kcal <= 30) continue;
    const atwater = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
    const dev = Math.abs(f.kcal - atwater) / f.kcal;
    assert.ok(dev <= 0.4, `${f.name}: kcal=${f.kcal}, Atwater=${atwater.toFixed(0)} (${(dev * 100).toFixed(0)}%)`);
  }
});

test('Alle Kategorien sind vertreten (Schinken, Torten, Joghurt, Käse, Suppen, Hauptgerichte …)', () => {
  const groups = new Set(FOODS.map((f) => f.group));
  for (const g of ['Wurst & Schinken', 'Süßes & Desserts', 'Milchprodukte', 'Käse', 'Suppen & Eintöpfe', 'Hauptgerichte', 'Vorspeisen']) {
    assert.ok(groups.has(g), `Gruppe fehlt: ${g}`);
  }
});

test('searchLocal findet gängige Lebensmittel', () => {
  for (const q of ['schinken', 'joghurt', 'gouda', 'linsensuppe', 'spaghetti']) {
    const r = searchLocal(q);
    assert.ok(r.length > 0, `keine Treffer für „${q}"`);
    assert.equal(r[0].source, 'local');
    assert.equal(r[0].basis, '100g');
  }
});

test('searchLocal ist umlaut-/akzenttolerant', () => {
  const withUml = searchLocal('käsekuchen');
  const noUml = searchLocal('kasekuchen');
  assert.ok(withUml.length > 0 && noUml.length > 0);
  assert.equal(withUml[0].name, noUml[0].name);
  assert.ok(/Käsekuchen/i.test(noUml[0].name));
});

test('searchLocal: zu kurz oder Unsinn → leer', () => {
  assert.deepEqual(searchLocal('a'), []);
  assert.deepEqual(searchLocal('xqzwk123nope'), []);
});
