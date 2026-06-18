// calc.js — Ernährungswissenschaftliche Berechnungen mit Gesundheits-Schutz.
// Alle Werte sind bewusst konservativ und vermeiden ungesunde Empfehlungen.

/** Energiegehalt von 1 kg Körpergewichtsveränderung (ca. Fettgewebe). */
export const KCAL_PER_KG = 7700;

/** Sichere tägliche Kalorien-Untergrenzen (Faustregel der Ernährungsberatung). */
export const MIN_KCAL = { female: 1200, male: 1500 };

/** Aktivitätsfaktoren (Multiplikator auf den Grundumsatz). */
export const ACTIVITY = {
  sedentary: { factor: 1.2, label: 'Wenig aktiv (Bürojob, kaum Sport)' },
  light: { factor: 1.375, label: 'Leicht aktiv (1–3× Sport/Woche)' },
  moderate: { factor: 1.55, label: 'Mäßig aktiv (3–5× Sport/Woche)' },
  active: { factor: 1.725, label: 'Sehr aktiv (6–7× Sport/Woche)' },
  very_active: { factor: 1.9, label: 'Extrem aktiv (Leistungssport/körperliche Arbeit)' },
};

/** Grundumsatz (BMR) nach Mifflin-St Jeor — der heute gängigste Standard. */
export function bmr({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Gesamtumsatz (TDEE) = Grundumsatz × Aktivitätsfaktor. */
export function tdee({ sex, weightKg, heightCm, age, activity }) {
  const factor = (ACTIVITY[activity] || ACTIVITY.moderate).factor;
  return bmr({ sex, weightKg, heightCm, age }) * factor;
}

/** Body-Mass-Index. */
export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Klartext-Einordnung des BMI. */
export function bmiCategory(value) {
  if (value < 18.5) return { key: 'under', label: 'Untergewicht' };
  if (value < 25) return { key: 'normal', label: 'Normalgewicht' };
  if (value < 30) return { key: 'over', label: 'Übergewicht' };
  return { key: 'obese', label: 'Adipositas' };
}

/**
 * Maximal gesunde wöchentliche Gewichtsänderung.
 * Abnehmen: höchstens 1 % des Körpergewichts pro Woche, gedeckelt bei 1,0 kg.
 * Zunehmen: behutsam, höchstens 0,5 kg/Woche (Muskelaufbau braucht Zeit).
 */
export function maxRate(weightKg, direction) {
  if (direction === 'gain') return 0.5;
  return Math.min(1.0, Math.max(0.25, +(weightKg * 0.01).toFixed(2)));
}

/** Empfohlene, angenehme Standardrate. */
export function recommendedRate(weightKg, direction) {
  if (direction === 'gain') return 0.25;
  return Math.min(0.5, maxRate(weightKg, direction));
}

/** Zielrichtung aus Start- und Zielgewicht ableiten. */
export function direction(currentKg, targetKg) {
  if (Math.abs(currentKg - targetKg) < 0.1) return 'maintain';
  return targetKg < currentKg ? 'lose' : 'gain';
}

/**
 * Zentrale Planung: berechnet Tagesziel, Zeitspanne und Gesundheitshinweise.
 * Liefert ein Objekt, das die UI direkt anzeigen kann.
 */
export function plan(profile) {
  const { sex, age, heightCm, activity } = profile;
  const currentKg = profile.currentWeightKg ?? profile.startWeightKg;
  const targetKg = profile.targetWeightKg;
  const dir = direction(currentKg, targetKg);

  const maintenance = tdee({ sex, weightKg: currentKg, heightCm, age, activity });
  const warnings = [];
  const notes = [];

  // Rate auf den gesunden Bereich begrenzen.
  const cap = maxRate(currentKg, dir);
  let rate = profile.rateKgPerWeek ?? recommendedRate(currentKg, dir);
  if (dir === 'maintain') rate = 0;
  if (rate > cap) {
    warnings.push(`Zu deiner Sicherheit habe ich das Tempo auf max. ${cap.toLocaleString('de-DE')} kg/Woche begrenzt.`);
    rate = cap;
  }

  // Tägliches Kaloriendefizit/-überschuss.
  const dailyDelta = (rate * KCAL_PER_KG) / 7;
  let target;
  if (dir === 'lose') target = maintenance - dailyDelta;
  else if (dir === 'gain') target = maintenance + dailyDelta;
  else target = maintenance;

  // Harte Untergrenze: niemals unter den sicheren Mindestwert.
  const floor = MIN_KCAL[sex] || 1200;
  let limitedByFloor = false;
  if (dir === 'lose' && target < floor) {
    target = floor;
    limitedByFloor = true;
    warnings.push(
      `Das gewünschte Tempo würde unter ${floor} kcal/Tag führen. Das ist auf Dauer ungesund — ich plane mit ${floor} kcal und einem sanfteren Tempo.`
    );
  }

  // Effektive Rate nach allen Begrenzungen (für eine ehrliche Zeitprognose).
  const effDailyDelta = Math.abs(maintenance - target);
  const effRate = (effDailyDelta * 7) / KCAL_PER_KG; // kg/Woche

  // Zeitspanne bis zum Ziel.
  const deltaKg = Math.abs(currentKg - targetKg);
  let weeks = dir === 'maintain' || effRate <= 0 ? 0 : deltaKg / effRate;
  const days = Math.round(weeks * 7);

  // BMI-Hinweise.
  const startBmi = bmi(currentKg, heightCm);
  const targetBmi = bmi(targetKg, heightCm);
  if (targetBmi < 18.5) {
    warnings.push('Dein Zielgewicht liegt im Untergewicht-Bereich. Bitte sprich das mit einer Ärztin/einem Arzt ab. ❤️');
  }
  if (dir === 'lose' && deltaKg < 0.5) {
    notes.push('Du bist quasi schon am Ziel — super!');
  }

  // Makro-Empfehlung (Richtwerte): viel Eiweiß hält satt & schützt Muskeln.
  const proteinG = Math.round(currentKg * (dir === 'lose' ? 2.0 : 1.6));
  const fatG = Math.round((target * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));

  return {
    direction: dir,
    maintenance: Math.round(maintenance),
    bmr: Math.round(bmr({ sex, weightKg: currentKg, heightCm, age })),
    targetCalories: Math.round(target),
    rate: +effRate.toFixed(2),
    requestedRate: +rate.toFixed(2),
    maxRate: cap,
    dailyDelta: Math.round(effDailyDelta),
    weeks: +weeks.toFixed(1),
    days,
    deltaKg: +deltaKg.toFixed(1),
    startBmi: +startBmi.toFixed(1),
    targetBmi: +targetBmi.toFixed(1),
    startBmiCat: bmiCategory(startBmi),
    targetBmiCat: bmiCategory(targetBmi),
    macros: { protein: proteinG, carbs: carbsG, fat: fatG },
    floor,
    limitedByFloor,
    warnings,
    notes,
  };
}

/** Fortschritt in Prozent (0–100) vom Start- zum Zielgewicht. */
export function progressPercent(startKg, currentKg, targetKg) {
  const total = Math.abs(startKg - targetKg);
  if (total < 0.01) return 100;
  const done = Math.abs(startKg - currentKg);
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}
