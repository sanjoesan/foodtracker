// Tests für die Berechnungslogik (Node Test Runner, keine Abhängigkeiten).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmr,
  tdee,
  bmi,
  bmiCategory,
  maxRate,
  direction,
  plan,
  progressPercent,
} from '../js/calc.js';

test('BMR nach Mifflin-St Jeor (Mann)', () => {
  // 80 kg, 180 cm, 30 J, männlich → 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }), 1780);
});

test('BMR nach Mifflin-St Jeor (Frau)', () => {
  // 65 kg, 165 cm, 30 J, weiblich → 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
  assert.ok(Math.abs(bmr({ sex: 'female', weightKg: 65, heightCm: 165, age: 30 }) - 1370.25) < 0.01);
});

test('TDEE wendet Aktivitätsfaktor an', () => {
  const b = bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 });
  assert.ok(Math.abs(tdee({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activity: 'sedentary' }) - b * 1.2) < 0.01);
});

test('BMI und Kategorien', () => {
  assert.ok(Math.abs(bmi(80, 180) - 24.69) < 0.1);
  assert.equal(bmiCategory(17).key, 'under');
  assert.equal(bmiCategory(22).key, 'normal');
  assert.equal(bmiCategory(27).key, 'over');
  assert.equal(bmiCategory(33).key, 'obese');
});

test('maxRate deckelt Abnehmtempo gesund', () => {
  assert.equal(maxRate(70, 'lose'), 0.7); // 1 % von 70 kg
  assert.equal(maxRate(150, 'lose'), 1.0); // bei 1,0 kg gedeckelt
  assert.equal(maxRate(60, 'lose'), 0.6);
  assert.equal(maxRate(20, 'lose'), 0.25); // Mindestens 0,25 erlaubt
  assert.equal(maxRate(80, 'gain'), 0.5); // Zunehmen behutsam
});

test('direction erkennt Ziel', () => {
  assert.equal(direction(80, 72), 'lose');
  assert.equal(direction(70, 75), 'gain');
  assert.equal(direction(70, 70), 'maintain');
});

test('plan begrenzt zu aggressives Tempo auf maxRate', () => {
  const p = plan({ sex: 'male', age: 30, heightCm: 180, activity: 'moderate', startWeightKg: 80, targetWeightKg: 72, rateKgPerWeek: 2.0 });
  assert.ok(p.rate <= p.maxRate + 0.001);
  assert.ok(p.warnings.length >= 1);
});

test('plan hält Kalorien-Untergrenze ein', () => {
  // Sehr aggressives Szenario für eine kleine Frau.
  const p = plan({ sex: 'female', age: 30, heightCm: 160, activity: 'sedentary', startWeightKg: 55, targetWeightKg: 50, rateKgPerWeek: 1.0 });
  assert.ok(p.targetCalories >= 1200, `targetCalories=${p.targetCalories}`);
});

test('plan liefert positive, plausible Zeitspanne', () => {
  const p = plan({ sex: 'male', age: 30, heightCm: 180, activity: 'moderate', startWeightKg: 90, targetWeightKg: 80, rateKgPerWeek: 0.5 });
  assert.equal(p.direction, 'lose');
  assert.ok(p.weeks > 0);
  assert.ok(p.targetCalories < p.maintenance);
});

test('progressPercent rechnet korrekt', () => {
  assert.equal(progressPercent(80, 76, 72), 50);
  assert.equal(progressPercent(80, 80, 72), 0);
  assert.equal(progressPercent(80, 72, 72), 100);
  assert.equal(progressPercent(80, 70, 72), 100); // über das Ziel hinaus → gedeckelt
});
