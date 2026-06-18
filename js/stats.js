// stats.js — reine Aggregationslogik für Wochenstatistiken (ohne DOM, daher testbar).

export const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Datum → 'YYYY-MM-DD' (lokale Zeit). */
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 'YYYY-MM-DD' → Date (lokale Zeit). */
export function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Tagessummen aus einem Tages-Objekt (Mahlzeiten) berechnen. */
export function totalsOf(day) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  if (!day) return t;
  for (const m of MEAL_KEYS) {
    for (const e of day[m] || []) {
      t.kcal += e.kcal || 0;
      t.protein += e.protein || 0;
      t.carbs += e.carbs || 0;
      t.fat += e.fat || 0;
    }
  }
  return t;
}

/** Liste der n Datumsschlüssel, die mit endKey enden (älteste zuerst). */
export function rangeKeys(endKey, n = 7) {
  const end = parseYMD(endKey);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    keys.push(ymd(d));
  }
  return keys;
}

/** Gilt ein Tag als „im Plan"? Abhängig vom Ziel (abnehmen/zunehmen/halten). */
export function isOnPlan(kcal, target, direction) {
  if (!target || kcal <= 0) return false;
  if (direction === 'gain') return kcal >= target * 0.95;
  if (direction === 'maintain') return Math.abs(kcal - target) <= target * 0.1;
  return kcal <= target * 1.05; // abnehmen (Standard)
}

/**
 * Wochenstatistik über die gegebenen Tagesschlüssel.
 * @param {object} days  Zustand state.days
 * @param {string[]} keys  Datumsschlüssel (z. B. aus rangeKeys)
 * @param {number} target  Tageskalorienziel
 * @param {string} direction  'lose' | 'gain' | 'maintain'
 */
export function weeklyStats(days, keys, target, direction = 'lose') {
  const perDay = keys.map((k) => {
    const t = totalsOf(days[k]);
    return { date: k, ...t, logged: t.kcal > 0, onPlan: isOnPlan(t.kcal, target, direction) };
  });
  const logged = perDay.filter((d) => d.logged);
  const sum = perDay.reduce(
    (a, d) => ({ kcal: a.kcal + d.kcal, protein: a.protein + d.protein, carbs: a.carbs + d.carbs, fat: a.fat + d.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const n = logged.length || 1;
  const avg = {
    kcal: Math.round(sum.kcal / n),
    protein: Math.round(sum.protein / n),
    carbs: Math.round(sum.carbs / n),
    fat: Math.round(sum.fat / n),
  };
  const daysOnPlan = logged.filter((d) => d.onPlan).length;
  const maxKcal = Math.max(target || 0, ...perDay.map((d) => d.kcal), 1);
  return {
    perDay,
    keys,
    daysLogged: logged.length,
    avg,
    total: sum,
    daysOnPlan,
    target,
    direction,
    maxKcal,
  };
}

/** Gewichtsänderung innerhalb eines Datumsfensters (erster vs. letzter Messwert). */
export function weightChangeInRange(weights, keys) {
  const start = keys[0];
  const end = keys[keys.length - 1];
  const inRange = weights
    .filter((w) => w.date >= start && w.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (inRange.length < 2) return null;
  return +(inRange[inRange.length - 1].kg - inRange[0].kg).toFixed(1);
}
