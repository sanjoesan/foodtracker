// Tests für die Wochenstatistik-Aggregation (reine Logik, kein DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeKeys, totalsOf, isOnPlan, weeklyStats, weightChangeInRange } from '../js/stats.js';

test('rangeKeys: 7 aufsteigende Tage, endend am endKey', () => {
  const keys = rangeKeys('2026-06-18', 7);
  assert.equal(keys.length, 7);
  assert.equal(keys[6], '2026-06-18');
  assert.equal(keys[0], '2026-06-12');
});

test('totalsOf summiert alle Mahlzeiten', () => {
  const day = {
    breakfast: [{ kcal: 300, protein: 10, carbs: 40, fat: 8 }],
    lunch: [{ kcal: 500, protein: 30, carbs: 50, fat: 15 }],
    dinner: [],
    snack: [{ kcal: 100, protein: 2, carbs: 20, fat: 1 }],
  };
  const t = totalsOf(day);
  assert.equal(t.kcal, 900);
  assert.equal(t.protein, 42);
  assert.equal(t.carbs, 110);
  assert.equal(t.fat, 24);
});

test('totalsOf für fehlenden Tag = 0', () => {
  assert.deepEqual(totalsOf(undefined), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test('isOnPlan respektiert die Zielrichtung', () => {
  assert.equal(isOnPlan(1900, 2000, 'lose'), true);
  assert.equal(isOnPlan(2100, 2000, 'lose'), true); // 5 % Toleranz
  assert.equal(isOnPlan(2300, 2000, 'lose'), false);
  assert.equal(isOnPlan(0, 2000, 'lose'), false); // nichts geloggt
  assert.equal(isOnPlan(2100, 2000, 'gain'), true);
  assert.equal(isOnPlan(1700, 2000, 'gain'), false);
  assert.equal(isOnPlan(2050, 2000, 'maintain'), true);
  assert.equal(isOnPlan(2300, 2000, 'maintain'), false);
});

test('weeklyStats aggregiert Durchschnitt, Summe und Tage im Plan', () => {
  const days = {
    '2026-06-16': { breakfast: [{ kcal: 2000, protein: 100, carbs: 200, fat: 60 }], lunch: [], dinner: [], snack: [] },
    '2026-06-17': { breakfast: [{ kcal: 1800, protein: 120, carbs: 150, fat: 50 }], lunch: [], dinner: [], snack: [] },
    '2026-06-18': { breakfast: [{ kcal: 2600, protein: 90, carbs: 300, fat: 90 }], lunch: [], dinner: [], snack: [] },
  };
  const keys = rangeKeys('2026-06-18', 7);
  const s = weeklyStats(days, keys, 2000, 'lose');
  assert.equal(s.perDay.length, 7);
  assert.equal(s.daysLogged, 3);
  assert.equal(s.total.kcal, 6400);
  assert.equal(s.avg.kcal, Math.round(6400 / 3));
  assert.equal(s.daysOnPlan, 2); // 2000 ok, 1800 ok, 2600 zu viel
  assert.ok(s.maxKcal >= 2600);
});

test('weightChangeInRange: erster vs. letzter Messwert im Fenster', () => {
  const weights = [
    { date: '2026-06-12', kg: 85 },
    { date: '2026-06-15', kg: 84.2 },
    { date: '2026-06-18', kg: 83.6 },
    { date: '2026-06-30', kg: 82 }, // außerhalb des Fensters
  ];
  const keys = rangeKeys('2026-06-18', 7);
  assert.equal(weightChangeInRange(weights, keys), -1.4);
});

test('weightChangeInRange: null bei weniger als 2 Messwerten', () => {
  const keys = rangeKeys('2026-06-18', 7);
  assert.equal(weightChangeInRange([{ date: '2026-06-18', kg: 80 }], keys), null);
  assert.equal(weightChangeInRange([], keys), null);
});
