// storage.js — lokale Persistenz im Browser (localStorage).
// Der komplette App-Zustand liegt als ein JSON-Objekt unter einem Schlüssel.
// So bleiben Speichern/Laden atomar und einfach exportierbar.

const KEY = 'foodtracker.v1';

/** Standardzustand für neue Nutzer:innen. */
export function emptyState() {
  return {
    profile: null, // { sex, age, heightCm, startWeightKg, targetWeightKg, rateKgPerWeek, activity, createdAt }
    weights: [], // [{ date: 'YYYY-MM-DD', kg: Number }]
    days: {}, // { 'YYYY-MM-DD': { breakfast:[], lunch:[], dinner:[], snack:[] } }
    customFoods: [], // eigene, wiederverwendbare Lebensmittel
    recent: [], // zuletzt genutzte Lebensmittel (Vorlagen) für Schnell-Hinzufügen
  };
}

/** Lädt den Zustand robust; fällt bei Fehlern auf den Leerzustand zurück. */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch (err) {
    console.warn('Konnte gespeicherte Daten nicht lesen, starte neu.', err);
    return emptyState();
  }
}

/** Speichert den Zustand. Gibt false zurück, falls der Speicher voll/blockiert ist. */
export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Speichern fehlgeschlagen.', err);
    return false;
  }
}

/** Vollständiger Export als hübsch formatiertes JSON (für Backups). */
export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

/** Import aus JSON-Text; wirft bei ungültigem Inhalt. */
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Ungültige Datei');
  return { ...emptyState(), ...parsed };
}

/** Löscht alle Daten unwiderruflich. */
export function clearAll() {
  localStorage.removeItem(KEY);
}
