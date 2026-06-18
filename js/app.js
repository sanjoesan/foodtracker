// app.js — Steuerung, Zustand und Oberfläche des Foodtrackers.
import * as store from './storage.js';
import * as calc from './calc.js';
import * as api from './api.js';
import * as scanner from './scanner.js';
import { COMMON_FOODS, searchLocal } from './db.js';
import * as stats from './stats.js';

/* ─────────────────────────── Zustand ─────────────────────────── */

let state = store.load();
let view = 'today'; // 'today' | 'week' | 'progress' | 'profile'
let selectedDate = ymd();
let weekOffset = 0; // 0 = aktuelle Woche (endet heute), -1 = Vorwoche …
let scanController = null; // aktiver Kamera-Scan

const persist = () => store.save(state);

/* ─────────────────────────── Theme (hell/dunkel) ─────────────────────────── */

function effectiveTheme() {
  const t = state.settings && state.settings.theme;
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme() {
  document.documentElement.dataset.theme = effectiveTheme();
}
function toggleTheme() {
  state.settings = state.settings || {};
  state.settings.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
  persist();
  applyTheme();
  renderTopbar();
  if (view === 'progress') drawWeightChart();
  if (view === 'week') drawCurrentWeek();
}

/* ─────────────────────────── Helfer ─────────────────────────── */

function ymd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) {
  const d = parseYMD(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function fmt(n, digits = 0) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
const MEALS = [
  { key: 'breakfast', label: 'Frühstück', emoji: '🌅' },
  { key: 'lunch', label: 'Mittagessen', emoji: '☀️' },
  { key: 'dinner', label: 'Abendessen', emoji: '🌙' },
  { key: 'snack', label: 'Snacks', emoji: '🍎' },
];

function mealByTime() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

function getDay(key) {
  if (!state.days[key]) state.days[key] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  // Sicherstellen, dass alle Mahlzeiten existieren (Migration alter Daten).
  for (const m of MEALS) if (!state.days[key][m.key]) state.days[key][m.key] = [];
  return state.days[key];
}

function currentWeight() {
  if (state.weights.length) {
    const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1].kg;
  }
  return state.profile?.startWeightKg ?? null;
}

function dayTotals(key) {
  const day = getDay(key);
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const m of MEALS) {
    for (const e of day[m.key]) {
      t.kcal += e.kcal;
      t.protein += e.protein;
      t.carbs += e.carbs;
      t.fat += e.fat;
    }
  }
  return t;
}

function currentPlan() {
  if (!state.profile) return null;
  return calc.plan({ ...state.profile, currentWeightKg: currentWeight() });
}

/* ─── Nährwerte für eine konkrete Portion berechnen ─── */
function resolveNutrition(food, amount, unit) {
  let factor;
  if (unit === 'piece') {
    if (food.basis === 'piece') factor = amount;
    else {
      const pw = food.pieceWeightG || food.servingG || 100;
      factor = (amount * pw) / 100;
    }
  } else {
    if (food.basis === 'piece') {
      const pw = food.pieceWeightG || 100;
      factor = amount / pw;
    } else {
      factor = amount / 100;
    }
  }
  return {
    kcal: Math.round((food.kcal || 0) * factor),
    protein: +((food.protein || 0) * factor).toFixed(1),
    carbs: +((food.carbs || 0) * factor).toFixed(1),
    fat: +((food.fat || 0) * factor).toFixed(1),
  };
}

function pushRecent(food) {
  const dedupeKey = (food.barcode || food.name + (food.brand || '')).toLowerCase();
  state.recent = state.recent.filter((f) => (f.barcode || f.name + (f.brand || '')).toLowerCase() !== dedupeKey);
  state.recent.unshift(food);
  state.recent = state.recent.slice(0, 24);
}

/* ─────────────────────────── Rendering ─────────────────────────── */

const $view = () => document.getElementById('view');
const $bar = () => document.getElementById('tabbar');
const $top = () => document.getElementById('topbar');

function render() {
  renderTopbar();
  renderTabbar();
  if (!state.profile) {
    view = 'profile';
    $view().innerHTML = renderOnboarding();
    bindProfile(true);
    return;
  }
  if (view === 'today') {
    $view().innerHTML = renderToday();
    bindToday();
  } else if (view === 'week') {
    $view().innerHTML = renderWeek();
    bindWeek();
  } else if (view === 'progress') {
    $view().innerHTML = renderProgress();
    bindProgress();
  } else {
    $view().innerHTML = renderProfile();
    bindProfile(false);
  }
}

function renderTopbar() {
  const streak = computeStreak();
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const isDark = effectiveTheme() === 'dark';
  $top().innerHTML = `
    <div class="brand">🥗 <span>Foodtracker</span></div>
    <div class="top-right">
      ${state.profile ? `<span class="greet">${greet}!${streak >= 2 ? ` <span class="flame" title="${streak} Tage in Folge">🔥 ${streak}</span>` : ''}</span>` : ''}
      <button class="theme-toggle" data-act="toggle-theme" aria-label="Helles/dunkles Design wechseln" title="Design wechseln">${isDark ? '☀️' : '🌙'}</button>
    </div>
  `;
}

function renderTabbar() {
  if (!state.profile) {
    $bar().innerHTML = '';
    return;
  }
  const tab = (key, icon, label) =>
    `<button class="tab ${view === key ? 'active' : ''}" data-act="view" data-view="${key}"><span class="ti">${icon}</span><span>${label}</span></button>`;
  $bar().innerHTML = `
    ${tab('today', '📅', 'Heute')}
    ${tab('week', '📊', 'Woche')}
    <button class="fab" data-act="quick-add" title="Essen hinzufügen">＋</button>
    ${tab('progress', '📈', 'Fortschritt')}
    ${tab('profile', '⚙️', 'Profil')}
  `;
}

/* ───────── Onboarding / Profil ───────── */

function profileFormFields(p) {
  const activityOpts = Object.entries(calc.ACTIVITY)
    .map(([k, v]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${esc(v.label)}</option>`)
    .join('');
  return `
    <div class="grid2">
      <label class="field">Geschlecht
        <select id="f-sex">
          <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Weiblich</option>
          <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Männlich</option>
        </select>
      </label>
      <label class="field">Alter
        <input id="f-age" type="number" min="14" max="100" value="${p.age ?? ''}" placeholder="z. B. 30">
      </label>
      <label class="field">Größe (cm)
        <input id="f-height" type="number" min="120" max="230" value="${p.heightCm ?? ''}" placeholder="z. B. 175">
      </label>
      <label class="field">Aktuelles Gewicht (kg)
        <input id="f-weight" type="number" min="35" max="300" step="0.1" value="${p.startWeightKg ?? ''}" placeholder="z. B. 80">
      </label>
      <label class="field">Zielgewicht (kg)
        <input id="f-target" type="number" min="35" max="300" step="0.1" value="${p.targetWeightKg ?? ''}" placeholder="z. B. 72">
      </label>
      <label class="field">Aktivität
        <select id="f-activity">${activityOpts}</select>
      </label>
    </div>
    <div class="field">
      <div class="rate-head">Tempo: <strong id="rate-val">–</strong> kg/Woche</div>
      <input id="f-rate" type="range" min="0.1" max="1.0" step="0.05" value="${p.rateKgPerWeek ?? 0.5}">
      <div class="rate-hint" id="rate-hint">Sanftes, gesundes Tempo wird empfohlen.</div>
    </div>
    <div id="plan-preview" class="plan-preview"></div>
  `;
}

function defaultProfile() {
  return { sex: 'female', age: '', heightCm: '', startWeightKg: '', targetWeightKg: '', activity: 'moderate', rateKgPerWeek: 0.5 };
}

function renderOnboarding() {
  const p = state.profile || defaultProfile();
  return `
    <div class="hero">
      <h1>Willkommen! 👋</h1>
      <p class="lead">Lass uns deinen persönlichen, <strong>gesunden</strong> Plan erstellen. Nur ein paar Angaben — dann kann's losgehen.</p>
    </div>
    <div class="card">
      ${profileFormFields(p)}
      <button class="btn primary block" data-act="save-profile">Plan erstellen 🚀</button>
    </div>
    <p class="fineprint">Alle Daten bleiben nur auf deinem Gerät (im Browser). Keine Anmeldung, kein Tracking.</p>
  `;
}

function renderProfile() {
  // Das Gewichtsfeld zeigt das *aktuelle* Gewicht (zuletzt protokolliert).
  const p = { ...state.profile, startWeightKg: currentWeight() ?? state.profile.startWeightKg };
  return `
    <h2 class="page-title">Dein Profil & Plan</h2>
    <div class="card">
      ${profileFormFields(p)}
      <button class="btn primary block" data-act="save-profile">Änderungen speichern</button>
    </div>

    <h3 class="section-title">Daten</h3>
    <div class="card data-actions">
      <button class="btn ghost" data-act="export">⬇️ Daten exportieren</button>
      <button class="btn ghost" data-act="import">⬆️ Daten importieren</button>
      <button class="btn danger ghost" data-act="reset">🗑️ Alles zurücksetzen</button>
    </div>
    <p class="fineprint">Version 1.1 · Lebensmitteldaten von <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> (ODbL). Keine medizinische Beratung.</p>
  `;
}

function readProfileForm() {
  const g = (id) => document.getElementById(id);
  return {
    sex: g('f-sex').value,
    age: Number(g('f-age').value),
    heightCm: Number(g('f-height').value),
    startWeightKg: Number(g('f-weight').value),
    targetWeightKg: Number(g('f-target').value),
    activity: g('f-activity').value,
    rateKgPerWeek: Number(g('f-rate').value),
  };
}

function validateProfile(p) {
  const errs = [];
  if (!(p.age >= 14 && p.age <= 100)) errs.push('Bitte ein realistisches Alter angeben (14–100).');
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) errs.push('Bitte eine Größe zwischen 120 und 230 cm angeben.');
  if (!(p.startWeightKg >= 35 && p.startWeightKg <= 300)) errs.push('Bitte ein realistisches Gewicht angeben.');
  if (!(p.targetWeightKg >= 35 && p.targetWeightKg <= 300)) errs.push('Bitte ein realistisches Zielgewicht angeben.');
  return errs;
}

function updatePlanPreview() {
  const box = document.getElementById('plan-preview');
  if (!box) return;
  const p = readProfileForm();
  // Slider-Grenzen dynamisch an Richtung & Gewicht anpassen.
  const dir = calc.direction(p.startWeightKg || 0, p.targetWeightKg || 0);
  const slider = document.getElementById('f-rate');
  const rateVal = document.getElementById('rate-val');
  const rateHint = document.getElementById('rate-hint');
  if (p.startWeightKg && p.targetWeightKg && dir !== 'maintain') {
    const cap = calc.maxRate(p.startWeightKg, dir);
    slider.max = String(cap);
    slider.min = dir === 'gain' ? '0.1' : '0.25';
    if (Number(slider.value) > cap) slider.value = String(cap);
    if (rateVal) rateVal.textContent = fmt(slider.value, 2);
    if (rateHint)
      rateHint.textContent =
        dir === 'gain'
          ? 'Beim Zunehmen ist langsames Tempo (≤ 0,5 kg/Woche) ideal für Muskelaufbau.'
          : `Gesund sind ${fmt(slider.min, 2)}–${fmt(cap, 2)} kg/Woche. Empfohlen: ${fmt(calc.recommendedRate(p.startWeightKg, dir), 2)}.`;
  } else {
    if (rateVal) rateVal.textContent = fmt(slider.value, 2);
  }

  const errs = validateProfile(p);
  if (errs.length) {
    box.innerHTML = `<div class="hint">Fülle die Felder aus, um deinen Plan zu sehen.</div>`;
    return;
  }
  const pl = calc.plan({ ...p, rateKgPerWeek: Number(slider.value) });
  const dirLabel = pl.direction === 'lose' ? 'Abnehmen' : pl.direction === 'gain' ? 'Zunehmen' : 'Gewicht halten';
  const eta =
    pl.direction === 'maintain'
      ? '—'
      : `${fmt(pl.weeks, 1)} Wochen (ca. ${fmt(pl.days)} Tage) · Ziel um den ${etaDate(pl.days)}`;
  box.innerHTML = `
    <div class="plan-grid">
      <div class="stat big"><span class="v">${fmt(pl.targetCalories)}</span><span class="l">kcal / Tag</span></div>
      <div class="stat"><span class="v">${fmt(pl.maintenance)}</span><span class="l">Erhaltungsbedarf</span></div>
      <div class="stat"><span class="v">${dirLabel}</span><span class="l">Ziel</span></div>
    </div>
    <div class="macro-line">
      <span>🥩 Eiweiß <strong>${fmt(pl.macros.protein)} g</strong></span>
      <span>🍚 Kohlenhydrate <strong>${fmt(pl.macros.carbs)} g</strong></span>
      <span>🥑 Fett <strong>${fmt(pl.macros.fat)} g</strong></span>
    </div>
    <div class="plan-eta">⏱️ ${eta}</div>
    <div class="bmi-row">
      <span class="badge bmi-${pl.targetBmiCat.key}">Ziel-BMI ${fmt(pl.targetBmi, 1)} · ${pl.targetBmiCat.label}</span>
    </div>
    ${pl.warnings.map((w) => `<div class="warn">⚠️ ${esc(w)}</div>`).join('')}
    ${pl.notes.map((n) => `<div class="note">💡 ${esc(n)}</div>`).join('')}
  `;
}

function etaDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function bindProfile(isOnboarding) {
  ['f-sex', 'f-age', 'f-height', 'f-weight', 'f-target', 'f-activity', 'f-rate'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updatePlanPreview);
      el.addEventListener('change', updatePlanPreview);
    }
  });
  updatePlanPreview();
}

function saveProfile() {
  const form = readProfileForm();
  const errs = validateProfile(form);
  if (errs.length) {
    toast(errs[0], 'error');
    return;
  }
  const wasNew = !state.profile;
  const enteredWeight = form.startWeightKg; // Feld „Aktuelles Gewicht“
  if (wasNew) {
    state.profile = { ...form, createdAt: ymd() };
    state.weights = [{ date: ymd(), kg: enteredWeight }];
  } else {
    // Die Basislinie (startWeightKg) bleibt der ursprüngliche Startpunkt für den Fortschritt …
    const baseline = state.profile.startWeightKg ?? enteredWeight;
    state.profile = { ...state.profile, ...form, startWeightKg: baseline, createdAt: state.profile.createdAt || ymd() };
    // … das eingegebene Gewicht zählt als heutiger Messwert.
    const today = ymd();
    const existing = state.weights.find((w) => w.date === today);
    if (existing) existing.kg = enteredWeight;
    else state.weights.push({ date: today, kg: enteredWeight });
    state.weights.sort((a, b) => a.date.localeCompare(b.date));
  }
  persist();
  view = 'today';
  render();
  toast(wasNew ? 'Dein Plan steht — los geht’s! 🎉' : 'Profil gespeichert ✅', 'success');
}

/* ───────── Heute ───────── */

function renderToday() {
  const pl = currentPlan();
  const totals = dayTotals(selectedDate);
  const target = pl.targetCalories;
  const remaining = target - totals.kcal;
  const pct = Math.min(100, Math.round((totals.kcal / target) * 100));
  const over = totals.kcal > target;
  const ring = calorieRing(totals.kcal, target);

  const isToday = selectedDate === ymd();
  const dateLabel = isToday
    ? 'Heute'
    : parseYMD(selectedDate).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const macro = (label, emoji, val, goal, cls) => {
    const p = goal ? Math.min(100, Math.round((val / goal) * 100)) : 0;
    return `
      <div class="macro">
        <div class="macro-top"><span>${emoji} ${label}</span><span>${fmt(val, 0)} / ${fmt(goal)} g</span></div>
        <div class="bar"><div class="bar-fill ${cls}" style="width:${p}%"></div></div>
      </div>`;
  };

  return `
    <div class="date-nav">
      <button class="icon-btn" data-act="day" data-delta="-1" aria-label="Vorheriger Tag">‹</button>
      <div class="date-label">${dateLabel}</div>
      <button class="icon-btn" data-act="day" data-delta="1" aria-label="Nächster Tag" ${isToday ? 'disabled' : ''}>›</button>
    </div>

    <div class="card today-hero">
      ${ring}
      <div class="ring-info">
        <div class="rem ${over ? 'over' : ''}">${over ? '+' + fmt(-remaining) : fmt(remaining)}</div>
        <div class="rem-label">${over ? 'kcal über dem Ziel' : 'kcal übrig'}</div>
        <div class="ring-sub">${fmt(totals.kcal)} / ${fmt(target)} kcal · ${pct}%</div>
      </div>
    </div>

    <div class="card">
      <div class="motiv">${motivation(remaining, target, totals, selectedDate)}</div>
      ${macro('Eiweiß', '🥩', totals.protein, pl.macros.protein, 'p')}
      ${macro('Kohlenhydrate', '🍚', totals.carbs, pl.macros.carbs, 'c')}
      ${macro('Fett', '🥑', totals.fat, pl.macros.fat, 'f')}
    </div>

    ${MEALS.map((m) => renderMealCard(m)).join('')}
  `;
}

function renderMealCard(meal) {
  const day = getDay(selectedDate);
  const items = day[meal.key];
  const sum = items.reduce((a, e) => a + e.kcal, 0);
  return `
    <div class="card meal">
      <div class="meal-head">
        <span class="meal-title">${meal.emoji} ${meal.label}</span>
        <span class="meal-sum">${fmt(sum)} kcal</span>
      </div>
      <div class="meal-items">
        ${
          items.length
            ? items
                .map(
                  (e) => `
          <div class="entry" data-id="${e.id}">
            <div class="entry-main">
              <div class="entry-name">${esc(e.name)}${e.brand ? ` <span class="brand">${esc(e.brand)}</span>` : ''}</div>
              <div class="entry-sub">${fmt(e.amount, e.unit === 'piece' ? 0 : 0)} ${unitLabel(e.unit, e.amount)} · ${fmt(e.protein, 1)} E / ${fmt(e.carbs, 1)} K / ${fmt(e.fat, 1)} F</div>
            </div>
            <div class="entry-kcal">${fmt(e.kcal)}</div>
            <button class="entry-del" data-act="del-entry" data-meal="${meal.key}" data-id="${e.id}" aria-label="Löschen">✕</button>
          </div>`
                )
                .join('')
            : `<div class="empty">Noch nichts eingetragen.</div>`
        }
      </div>
      <button class="btn add-btn" data-act="add" data-meal="${meal.key}">＋ Hinzufügen</button>
    </div>
  `;
}

function unitLabel(unit, amount) {
  if (unit === 'piece') return amount === 1 ? 'Stück' : 'Stück';
  if (unit === 'ml') return 'ml';
  return 'g';
}

function calorieRing(consumed, target) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, target ? consumed / target : 0));
  const dash = C * frac;
  const over = consumed > target;
  return `
    <svg class="ring" viewBox="0 0 120 120" width="150" height="150">
      <circle cx="60" cy="60" r="${R}" class="ring-bg"/>
      <circle cx="60" cy="60" r="${R}" class="ring-fg ${over ? 'over' : ''}"
        stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"
        transform="rotate(-90 60 60)" stroke-linecap="round"/>
      <text x="60" y="56" class="ring-num">${fmt(consumed)}</text>
      <text x="60" y="74" class="ring-cap">kcal</text>
    </svg>`;
}

function motivation(remaining, target, totals, dateKey) {
  if (totals.kcal === 0) {
    const tips = [
      'Ein guter Tag beginnt mit einer bewussten Entscheidung. Trag deine erste Mahlzeit ein! 🌱',
      'Jeder Eintrag bringt dich deinem Ziel näher. Los geht’s! 💪',
      'Frischer Tag, frische Chance. Was gibt’s heute Leckeres? 🍽️',
    ];
    return tips[parseYMD(dateKey).getDate() % tips.length];
  }
  const ratio = totals.kcal / target;
  if (ratio < 0.5) return 'Super Start! Du hast noch reichlich Spielraum für ausgewogene Mahlzeiten. 🌟';
  if (ratio < 0.85) return 'Du liegst gut im Plan — weiter so! 👏';
  if (ratio <= 1.0) return `Fast am Tagesziel und ${fmt(remaining)} kcal übrig. Perfekt austariert! 🎯`;
  if (ratio <= 1.1) return 'Knapp drüber — kein Drama. Morgen ist ein neuer Tag, du machst das klasse! 🤗';
  return 'Heute etwas mehr — das gehört dazu. Bleib dran, der Gesamttrend zählt! 💚';
}

function bindToday() {
  // Klicks werden zentral in setupGlobalEvents() behandelt.
}

/* ───────── Fortschritt ───────── */

function renderProgress() {
  const pl = currentPlan();
  const start = state.profile.startWeightKg;
  const cur = currentWeight();
  const target = state.profile.targetWeightKg;
  const pct = calc.progressPercent(start, cur, target);
  const dir = pl.direction;
  const changed = +(start - cur).toFixed(1);
  const toGo = +Math.abs(cur - target).toFixed(1);

  const streak = computeStreak();
  const loggedDays = Object.keys(state.days).filter((k) => dayTotals(k).kcal > 0).length;

  return `
    <h2 class="page-title">Dein Fortschritt</h2>

    <div class="card">
      <div class="progress-head">
        <div><span class="big-num">${fmt(cur, 1)}</span> kg <span class="muted">aktuell</span></div>
        <div class="goal-pill">${dir === 'lose' ? 'Ziel: −' : dir === 'gain' ? 'Ziel: +' : 'Ziel: '}${fmt(Math.abs(start - target), 1)} kg</div>
      </div>
      <div class="bar big"><div class="bar-fill goal" style="width:${pct}%"></div></div>
      <div class="progress-foot">
        <span>Start ${fmt(start, 1)} kg</span>
        <span><strong>${pct}%</strong> geschafft</span>
        <span>Ziel ${fmt(target, 1)} kg</span>
      </div>
    </div>

    <div class="stat-row">
      <div class="card stat3"><span class="v">${changed > 0 ? '−' : changed < 0 ? '+' : ''}${fmt(Math.abs(changed), 1)} kg</span><span class="l">${changed >= 0 ? 'abgenommen' : 'zugenommen'}</span></div>
      <div class="card stat3"><span class="v">${fmt(toGo, 1)} kg</span><span class="l">bis zum Ziel</span></div>
      <div class="card stat3"><span class="v">🔥 ${streak}</span><span class="l">Tage-Serie</span></div>
    </div>

    <div class="card">
      <h3 class="section-title flush">Gewichtsverlauf</h3>
      <canvas id="weight-chart" height="220"></canvas>
      ${state.weights.length < 2 ? '<div class="hint">Trag regelmäßig dein Gewicht ein, um deinen Trend zu sehen.</div>' : ''}
    </div>

    <div class="card">
      <h3 class="section-title flush">Gewicht eintragen</h3>
      <div class="weigh-form">
        <div class="weigh-main">
          <input id="w-kg" type="number" inputmode="decimal" step="0.1" min="35" max="300" placeholder="Gewicht in kg" value="${cur ?? ''}">
          <button class="btn primary save-icon" data-act="log-weight" aria-label="Gewicht speichern" title="Speichern">✓</button>
        </div>
        <input id="w-date" type="date" value="${ymd()}" max="${ymd()}" aria-label="Datum">
      </div>
    </div>

    <div class="card eta-card">
      <div>⏱️ <strong>Prognose</strong></div>
      ${
        dir === 'maintain'
          ? '<div class="muted">Du hältst dein Gewicht — klasse Balance!</div>'
          : pl.weeks > 0
          ? `<div>Bei <strong>${fmt(pl.rate, 2)} kg/Woche</strong> erreichst du dein Ziel in <strong>${fmt(pl.weeks, 1)} Wochen</strong> — etwa am <strong>${etaDate(pl.days)}</strong>.</div>`
          : '<div class="muted">Du bist am Ziel angekommen — herzlichen Glückwunsch! 🎉</div>'
      }
      <div class="muted small">Insgesamt ${loggedDays} Tag(e) protokolliert.</div>
    </div>
  `;
}

function bindProgress() {
  drawWeightChart();
}

function logWeight() {
  const date = document.getElementById('w-date').value || ymd();
  const kg = Number(document.getElementById('w-kg').value);
  if (!(kg >= 35 && kg <= 300)) {
    toast('Bitte ein realistisches Gewicht eingeben.', 'error');
    return;
  }
  const existing = state.weights.find((w) => w.date === date);
  if (existing) existing.kg = kg;
  else state.weights.push({ date, kg });
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  persist();
  render();
  toast('Gewicht gespeichert 📌', 'success');
}

function drawWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth - 32;
  const cssH = 220;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const data = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const target = state.profile.targetWeightKg;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#16a34a';
  const warm = css.getPropertyValue('--warm').trim() || '#ea580c';
  const grid = css.getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,0.08)';
  const text = css.getPropertyValue('--muted').trim() || '#64748b';

  if (data.length < 1) return;

  const pad = { l: 38, r: 14, t: 16, b: 24 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;

  const kgs = data.map((d) => d.kg).concat([target]);
  let min = Math.min(...kgs);
  let max = Math.max(...kgs);
  const span = Math.max(1, max - min);
  min -= span * 0.15;
  max += span * 0.15;

  const x = (i) => pad.l + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (kg) => pad.t + h - ((kg - min) / (max - min)) * h;

  // Gitter + Y-Beschriftung
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = text;
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const val = min + ((max - min) * i) / 4;
    const yy = y(val);
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(cssW - pad.r, yy);
    ctx.stroke();
    ctx.fillText(val.toFixed(0), 6, yy + 4);
  }

  // Ziel-Linie
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = warm;
  ctx.beginPath();
  ctx.moveTo(pad.l, y(target));
  ctx.lineTo(cssW - pad.r, y(target));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = warm;
  ctx.fillText('Ziel ' + target, pad.l + 4, y(target) - 5);

  // Verlaufslinie
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  data.forEach((d, i) => (i ? ctx.lineTo(x(i), y(d.kg)) : ctx.moveTo(x(i), y(d.kg))));
  ctx.stroke();

  // Punkte
  ctx.fillStyle = accent;
  data.forEach((d, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(d.kg), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function computeStreak() {
  // Aufeinanderfolgende Tage mit ≥1 Eintrag, endend heute oder gestern.
  let day = ymd();
  if (dayTotals(day).kcal === 0) {
    const yest = addDays(day, -1);
    if (dayTotals(yest).kcal === 0) return 0;
    day = yest;
  }
  let streak = 0;
  while (dayTotals(day).kcal > 0) {
    streak++;
    day = addDays(day, -1);
    if (streak > 3650) break;
  }
  return streak;
}

/* ───────── Wochenstatistiken ───────── */

function formatRange(keys) {
  const a = parseYMD(keys[0]);
  const b = parseYMD(keys[keys.length - 1]);
  const sameMonth = a.getMonth() === b.getMonth();
  const dd = (d) => d.toLocaleDateString('de-DE', { day: 'numeric' });
  const ddm = (d) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return `${sameMonth ? dd(a) + '.' : ddm(a)} – ${ddm(b)}`;
}

let _weekStats = null;

function getWeekStats() {
  const pl = currentPlan();
  const anchor = addDays(ymd(), weekOffset * 7);
  const keys = stats.rangeKeys(anchor, 7);
  const s = stats.weeklyStats(state.days, keys, pl.targetCalories, pl.direction);
  s.weightChange = stats.weightChangeInRange(state.weights, keys);
  return s;
}

function weekMacroBar(label, val, goal, cls) {
  const p = goal ? Math.min(100, Math.round((val / goal) * 100)) : 0;
  return `<div class="macro"><div class="macro-top"><span>${label}</span><span>${fmt(val)} / ${fmt(goal)} g</span></div><div class="bar"><div class="bar-fill ${cls}" style="width:${p}%"></div></div></div>`;
}

function weekMessage(s) {
  if (!s.daysLogged) return '📊 Noch keine Einträge in dieser Woche — leg los und sieh deinen Wochentrend wachsen!';
  if (s.daysLogged >= 6 && s.daysOnPlan >= 5) return '🌟 Überragende Woche! Du bleibst super konstant — genau so erreichst du dein Ziel.';
  if (s.daysOnPlan >= Math.ceil(s.daysLogged * 0.6)) return '👏 Starke Woche! Die meisten Tage lagen im Plan. Weiter dranbleiben!';
  if (s.daysLogged >= 4) return '💪 Gut protokolliert! Achte nächste Woche auf ein paar Tage mehr im Plan — du schaffst das.';
  return '🌱 Jeder Tag zählt. Trag fleißig ein, dann wird dein Wochenbild immer aussagekräftiger.';
}

function renderWeek() {
  const pl = currentPlan();
  const s = getWeekStats();
  _weekStats = s;
  const isCurrent = weekOffset === 0;
  const rangeLabel = formatRange(s.keys);
  const dirWord = pl.direction === 'gain' ? 'unter' : 'über';

  return `
    <div class="date-nav">
      <button class="icon-btn" data-act="week" data-delta="-1" aria-label="Vorherige Woche">‹</button>
      <div class="date-label">${isCurrent ? 'Diese Woche' : 'Woche'}</div>
      <button class="icon-btn" data-act="week" data-delta="1" aria-label="Nächste Woche" ${isCurrent ? 'disabled' : ''}>›</button>
    </div>

    <div class="card">
      <div class="muted small" style="text-align:center;margin-bottom:6px">${rangeLabel}</div>
      <canvas id="week-chart" height="200"></canvas>
      <div class="legend">
        <span><span class="dot ok"></span> im Plan</span>
        <span><span class="dot over"></span> ${dirWord} dem Ziel</span>
        <span>┄ Ziel ${fmt(pl.targetCalories)} kcal</span>
      </div>
    </div>

    <div class="week-summary">
      <div class="card week-stat"><span class="v">${s.daysLogged ? fmt(s.avg.kcal) : '–'}</span><span class="l">Ø kcal / Tag</span></div>
      <div class="card week-stat"><span class="v">${s.daysLogged}/7</span><span class="l">Tage protokolliert</span></div>
      <div class="card week-stat"><span class="v">${s.daysOnPlan}/${s.daysLogged || 0}</span><span class="l">Tage im Plan</span></div>
      <div class="card week-stat"><span class="v">${s.weightChange == null ? '–' : (s.weightChange > 0 ? '+' : '') + fmt(s.weightChange, 1) + ' kg'}</span><span class="l">Gewicht diese Woche</span></div>
    </div>

    <div class="card">
      <h3 class="section-title flush">Ø Makros pro Tag</h3>
      ${weekMacroBar('🥩 Eiweiß', s.avg.protein, pl.macros.protein, 'p')}
      ${weekMacroBar('🍚 Kohlenhydrate', s.avg.carbs, pl.macros.carbs, 'c')}
      ${weekMacroBar('🥑 Fett', s.avg.fat, pl.macros.fat, 'f')}
    </div>

    <div class="card eta-card">
      <div>${weekMessage(s)}</div>
    </div>
  `;
}

function bindWeek() {
  drawCurrentWeek();
}

function drawCurrentWeek() {
  if (_weekStats) drawWeekChart(_weekStats);
}

function drawWeekChart(s) {
  const canvas = document.getElementById('week-chart');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth - 32;
  const cssH = 200;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#16a34a';
  const warm = css.getPropertyValue('--warm').trim() || '#ea580c';
  const grid = css.getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,0.08)';
  const textCol = css.getPropertyValue('--muted').trim() || '#64748b';

  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;
  const max = (s.maxKcal || 1) * 1.1;
  const y = (v) => pad.t + h - (v / max) * h;
  const n = s.perDay.length;
  const slot = w / n;
  const bw = Math.min(34, slot * 0.6);

  ctx.font = '10px system-ui, sans-serif';
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const val = (max * i) / 4;
    const yy = y(val);
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(cssW - pad.r, yy);
    ctx.stroke();
    ctx.fillStyle = textCol;
    ctx.fillText(String(Math.round(val)), 2, yy + 3);
  }

  s.perDay.forEach((d, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const barH = d.kcal > 0 ? Math.max(2, (d.kcal / max) * h) : 0;
    const x0 = cx - bw / 2;
    const y0 = pad.t + h - barH;
    const r = Math.min(5, bw / 2);
    ctx.fillStyle = d.kcal === 0 ? grid : d.onPlan ? accent : warm;
    ctx.beginPath();
    ctx.moveTo(x0, pad.t + h);
    ctx.lineTo(x0, y0 + r);
    ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
    ctx.lineTo(x0 + bw - r, y0);
    ctx.quadraticCurveTo(x0 + bw, y0, x0 + bw, y0 + r);
    ctx.lineTo(x0 + bw, pad.t + h);
    ctx.closePath();
    ctx.fill();

    const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][parseYMD(d.date).getDay()];
    ctx.fillStyle = textCol;
    ctx.textAlign = 'center';
    ctx.fillText(wd, cx, cssH - 6);
    ctx.textAlign = 'left';
  });

  if (s.target) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = warm;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, y(s.target));
    ctx.lineTo(cssW - pad.r, y(s.target));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ─────────────────────────── Essen hinzufügen (Modal) ─────────────────────────── */

let addContext = { meal: 'breakfast', tab: 'search' };
let searchTimer = null;

function openAddSheet(meal) {
  addContext = { meal: meal || mealByTime(), tab: 'search' };
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="overlay" data-act="close-modal-bg">
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-head">
          <div class="sheet-title">Hinzufügen zu
            <select id="add-meal">${MEALS.map((m) => `<option value="${m.key}" ${addContext.meal === m.key ? 'selected' : ''}>${m.emoji} ${m.label}</option>`).join('')}</select>
          </div>
          <button class="icon-btn" data-act="close-modal" aria-label="Schließen">✕</button>
        </div>
        <div class="tabs">
          <button class="t-tab active" data-act="add-tab" data-tab="search">🔎 Suche</button>
          <button class="t-tab" data-act="add-tab" data-tab="scan">📷 Scan</button>
          <button class="t-tab" data-act="add-tab" data-tab="manual">✏️ Manuell</button>
        </div>
        <div class="sheet-body" id="sheet-body"></div>
      </div>
    </div>`;
  document.getElementById('add-meal').addEventListener('change', (e) => (addContext.meal = e.target.value));
  renderAddTab('search');
}

function closeModal() {
  if (scanController) {
    scanController.stop();
    scanController = null;
  }
  document.getElementById('modal-root').innerHTML = '';
}

function renderAddTab(tab) {
  addContext.tab = tab;
  document.querySelectorAll('.t-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (scanController) {
    scanController.stop();
    scanController = null;
  }
  const body = document.getElementById('sheet-body');
  if (tab === 'search') body.innerHTML = renderSearchTab();
  else if (tab === 'scan') body.innerHTML = renderScanTab();
  else body.innerHTML = renderManualTab();

  if (tab === 'search') {
    const inp = document.getElementById('search-input');
    inp.addEventListener('input', onSearchInput);
    inp.focus();
    renderQuickPicks();
  }
}

function renderSearchTab() {
  return `
    <div class="search-bar">
      <input id="search-input" type="search" placeholder="Lebensmittel suchen … z. B. Haferflocken" autocomplete="off">
      <div id="search-status" class="hint"></div>
    </div>
    <div id="search-results"></div>
    <div id="quick-picks"></div>
  `;
}

function renderQuickPicks() {
  const wrap = document.getElementById('quick-picks');
  if (!wrap) return;
  const recent = state.recent.slice(0, 8);
  const customs = state.customFoods.slice(0, 8);
  const groups = [];
  if (recent.length)
    groups.push(`<h4 class="pick-title">Zuletzt verwendet</h4><div class="chips">${recent.map((f, i) => chip(f, 'recent', i)).join('')}</div>`);
  if (customs.length)
    groups.push(`<h4 class="pick-title">Eigene Lebensmittel</h4><div class="chips">${customs.map((f, i) => chip(f, 'custom', i)).join('')}</div>`);
  groups.push(
    `<h4 class="pick-title">Häufige Lebensmittel</h4><div class="chips">${COMMON_FOODS.slice(0, 18).map((f, i) => chip({ ...f, source: 'local' }, 'common', i)).join('')}</div>`
  );
  wrap.innerHTML = groups.join('');
}

function chip(food, kind, i) {
  return `<button class="chip" data-act="pick" data-kind="${kind}" data-i="${i}">${food.emoji || '🍽️'} ${esc(food.name)}<small>${fmt(food.kcal)} kcal</small></button>`;
}

let lastResults = [];
let searchSeq = 0;
let searchAbort = null;
const searchCache = new Map(); // Suchbegriff (klein) → Online-Treffer; spart wiederholte Anfragen
const SEARCH_DEBOUNCE = 600; // ms warten, bis getippt fertig ist (schont das API-Rate-Limit)

function renderMerged(results, status, local, remote, q) {
  const merged = [...local, ...remote];
  lastResults = merged;
  results.innerHTML = resultList(merged);
  status.textContent = merged.length ? '' : `Keine Treffer für „${esc(q)}“ gefunden — versuch’s mit „Manuell“. ✏️`;
}

function onSearchInput(e) {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  const status = document.getElementById('search-status');
  const results = document.getElementById('search-results');
  const picks = document.getElementById('quick-picks');
  if (q.length < 2) {
    results.innerHTML = '';
    status.textContent = '';
    if (picks) picks.style.display = '';
    return;
  }
  if (picks) picks.style.display = 'none';
  // Sofort lokale Treffer zeigen (ohne Wartezeit, ohne Netzwerk).
  const local = searchLocal(q);
  lastResults = local;
  results.innerHTML = resultList(local);

  // Bereits gesuchte Begriffe aus dem Cache bedienen — keine neue Anfrage.
  const key = q.toLowerCase();
  if (searchCache.has(key)) {
    renderMerged(results, status, local, searchCache.get(key), q);
    return;
  }

  // Status bewusst noch leer lassen — "Suche…" erscheint erst beim echten Senden,
  // nicht bei jedem einzelnen Tastendruck.
  status.textContent = '';
  const seq = ++searchSeq;
  searchTimer = setTimeout(async () => {
    status.textContent = 'Suche bei Open Food Facts …';
    if (searchAbort) searchAbort.abort(); // evtl. noch laufende Anfrage stoppen
    searchAbort = new AbortController();
    let remote;
    let err = null;
    try {
      remote = await api.searchFoods(q, { signal: searchAbort.signal });
    } catch (e2) {
      err = e2;
    }
    if (seq !== searchSeq) return; // veraltete Antwort einer früheren Eingabe verwerfen
    if (err) {
      if (err.name === 'AbortError') return; // bewusst abgebrochen — keine Meldung
      if (err.status === 429 || (err.status >= 500 && err.status < 600)) {
        // Rate-Limit oder überlasteter Server → später erneut, nicht sofort nachfeuern.
        status.textContent = '⏳ Die Lebensmittel-Datenbank ist gerade überlastet — versuch’s in ein paar Sekunden erneut. Lokale Treffer & „Manuell“ stehen bereit.';
      } else {
        status.textContent = local.length
          ? '⚠️ Online-Suche gerade nicht erreichbar — lokale Treffer werden angezeigt.'
          : '⚠️ Online-Suche gerade nicht erreichbar. Versuch’s gleich erneut oder nutze „Manuell“. ✏️';
      }
      return;
    }
    searchCache.set(key, remote);
    if (searchCache.size > 60) searchCache.delete(searchCache.keys().next().value);
    renderMerged(results, status, local, remote, q);
  }, SEARCH_DEBOUNCE);
}

function resultList(foods) {
  if (!foods.length) return '';
  return `<div class="results">${foods
    .map(
      (f, i) => `
    <button class="result" data-act="pick-result" data-i="${i}">
      ${f.image ? `<img src="${esc(f.image)}" alt="" loading="lazy">` : `<span class="result-emoji">${f.emoji || '🍽️'}</span>`}
      <span class="result-main">
        <span class="result-name">${esc(f.name)}</span>
        <span class="result-sub">${f.brand ? esc(f.brand) + ' · ' : ''}${fmt(f.kcal)} kcal / 100${f.basis === 'piece' ? ' Stk' : 'g'}${f.nutriscore ? ` · Nutri-Score ${f.nutriscore.toUpperCase()}` : ''}</span>
      </span>
      <span class="result-add">＋</span>
    </button>`
    )
    .join('')}</div>`;
}

function renderScanTab() {
  if (!scanner.hasCamera()) {
    return `<div class="scan-fallback">
      <p>📷 Dein Browser erlaubt keinen Kamerazugriff. Gib den Barcode einfach von Hand ein:</p>
      ${barcodeManualInput()}
    </div>`;
  }
  const note = scanner.hasNativeDetector()
    ? ''
    : '<div class="hint">Scanner wird beim ersten Start kurz nachgeladen …</div>';
  return `
    <div class="scanner">
      <video id="scan-video" playsinline></video>
      <div class="scan-frame"></div>
    </div>
    ${note}
    <button class="btn primary block" data-act="start-scan">Kamera starten</button>
    <div class="or">— oder —</div>
    ${barcodeManualInput()}
  `;
}

function barcodeManualInput() {
  return `<div class="barcode-manual">
    <input id="barcode-input" type="text" inputmode="numeric" placeholder="Barcode (EAN), z. B. 4006040000000">
    <button class="btn" data-act="lookup-barcode">Suchen</button>
  </div>`;
}

async function startScanFlow() {
  const video = document.getElementById('scan-video');
  const btn = document.querySelector('[data-act="start-scan"]');
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Kamera läuft … Barcode zeigen';
    }
    scanController = await scanner.startScan(video, (code) => {
      scanController = null;
      handleBarcode(code);
    });
  } catch (err) {
    toast('Kamera nicht verfügbar: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Kamera starten';
    }
  }
}

async function handleBarcode(code) {
  const status = document.getElementById('sheet-body');
  toast('Barcode ' + code + ' wird gesucht …', 'info');
  try {
    const food = await api.lookupBarcode(code);
    if (!food) {
      toast('Produkt nicht in der Datenbank. Trag es manuell ein. ✏️', 'error');
      renderAddTab('manual');
      const ni = document.getElementById('m-name');
      if (ni) ni.value = '';
      return;
    }
    openPortion(food);
  } catch (err) {
    toast('Abruf fehlgeschlagen: ' + err.message, 'error');
  }
}

function renderManualTab() {
  return `
    <div class="manual-form">
      <label class="field">Name
        <input id="m-name" type="text" placeholder="z. B. Selbstgemachter Smoothie">
      </label>
      <div class="grid2">
        <label class="field">Bezug
          <select id="m-basis">
            <option value="100g">pro 100 g/ml</option>
            <option value="piece">pro Stück/Portion</option>
          </select>
        </label>
        <label class="field">Kalorien (kcal)
          <input id="m-kcal" type="number" min="0" step="1" placeholder="kcal">
        </label>
        <label class="field">Eiweiß (g)
          <input id="m-protein" type="number" min="0" step="0.1" placeholder="optional">
        </label>
        <label class="field">Kohlenhydrate (g)
          <input id="m-carbs" type="number" min="0" step="0.1" placeholder="optional">
        </label>
        <label class="field">Fett (g)
          <input id="m-fat" type="number" min="0" step="0.1" placeholder="optional">
        </label>
        <label class="field">Stück-Gewicht (g)
          <input id="m-pw" type="number" min="0" step="1" placeholder="optional">
        </label>
      </div>
      <label class="check"><input id="m-save" type="checkbox"> Als eigenes Lebensmittel speichern</label>
      <button class="btn primary block" data-act="add-manual">Weiter zur Menge →</button>
    </div>
  `;
}

function addManual() {
  const g = (id) => document.getElementById(id);
  const name = g('m-name').value.trim();
  const kcal = Number(g('m-kcal').value);
  if (!name) return toast('Bitte einen Namen angeben.', 'error');
  if (!(kcal >= 0)) return toast('Bitte Kalorien angeben.', 'error');
  const food = {
    source: 'manual',
    name,
    brand: '',
    basis: g('m-basis').value,
    kcal,
    protein: Number(g('m-protein').value) || 0,
    carbs: Number(g('m-carbs').value) || 0,
    fat: Number(g('m-fat').value) || 0,
    pieceWeightG: Number(g('m-pw').value) || null,
  };
  if (g('m-save').checked) {
    state.customFoods.unshift({ ...food, id: uid() });
    state.customFoods = state.customFoods.slice(0, 100);
    persist();
  }
  openPortion(food);
}

/* ───────── Portionsdialog ───────── */

let portionFood = null;
function openPortion(food) {
  portionFood = food;
  const canPiece = food.basis === 'piece' || food.pieceWeightG || food.servingG;
  const defUnit = food.basis === 'piece' ? 'piece' : 'g';
  const defAmount = food.basis === 'piece' ? 1 : food.servingG || 100;
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="overlay" data-act="close-modal-bg">
      <div class="sheet portion" role="dialog" aria-modal="true">
        <div class="sheet-head">
          <div class="sheet-title">${esc(food.name)}</div>
          <button class="icon-btn" data-act="close-modal" aria-label="Schließen">✕</button>
        </div>
        <div class="sheet-body">
          ${food.brand ? `<div class="muted">${esc(food.brand)}</div>` : ''}
          <div class="portion-row">
            <label class="field">Menge
              <input id="p-amount" type="number" min="0" step="${defUnit === 'piece' ? '1' : '1'}" value="${defAmount}">
            </label>
            <label class="field">Einheit
              <select id="p-unit">
                <option value="g" ${defUnit === 'g' ? 'selected' : ''}>Gramm (g)</option>
                <option value="ml">Milliliter (ml)</option>
                ${canPiece ? `<option value="piece" ${defUnit === 'piece' ? 'selected' : ''}>Stück</option>` : ''}
              </select>
            </label>
            <label class="field">Mahlzeit
              <select id="p-meal">${MEALS.map((m) => `<option value="${m.key}" ${addContext.meal === m.key ? 'selected' : ''}>${m.emoji} ${m.label}</option>`).join('')}</select>
            </label>
          </div>
          <div class="portion-presets">
            ${[50, 100, 150, 200].map((g) => `<button class="chip mini" data-act="preset" data-g="${g}">${g} g</button>`).join('')}
            ${canPiece ? [1, 2, 3].map((n) => `<button class="chip mini" data-act="preset-piece" data-n="${n}">${n} Stk</button>`).join('') : ''}
          </div>
          <div id="portion-preview" class="portion-preview"></div>
          <button class="btn primary block" data-act="confirm-portion">Eintragen ✅</button>
        </div>
      </div>
    </div>`;
  ['p-amount', 'p-unit'].forEach((id) => document.getElementById(id).addEventListener('input', updatePortionPreview));
  document.getElementById('p-unit').addEventListener('change', updatePortionPreview);
  updatePortionPreview();
}

function updatePortionPreview() {
  const amount = Number(document.getElementById('p-amount').value) || 0;
  const unit = document.getElementById('p-unit').value;
  const n = resolveNutrition(portionFood, amount, unit);
  document.getElementById('portion-preview').innerHTML = `
    <div class="pp-kcal">${fmt(n.kcal)} <span>kcal</span></div>
    <div class="pp-macros">
      <span>🥩 ${fmt(n.protein, 1)} g</span>
      <span>🍚 ${fmt(n.carbs, 1)} g</span>
      <span>🥑 ${fmt(n.fat, 1)} g</span>
    </div>`;
}

function confirmPortion() {
  const amount = Number(document.getElementById('p-amount').value) || 0;
  const unit = document.getElementById('p-unit').value;
  const meal = document.getElementById('p-meal').value;
  if (amount <= 0) return toast('Bitte eine Menge größer 0 eingeben.', 'error');
  const n = resolveNutrition(portionFood, amount, unit);
  const entry = {
    id: uid(),
    name: portionFood.name,
    brand: portionFood.brand || '',
    amount,
    unit,
    ...n,
    source: portionFood.source,
    barcode: portionFood.barcode || null,
  };
  getDay(selectedDate)[meal].push(entry);
  pushRecent({
    source: portionFood.source,
    name: portionFood.name,
    brand: portionFood.brand || '',
    basis: portionFood.basis,
    kcal: portionFood.kcal,
    protein: portionFood.protein,
    carbs: portionFood.carbs,
    fat: portionFood.fat,
    pieceWeightG: portionFood.pieceWeightG || null,
    servingG: portionFood.servingG || null,
    barcode: portionFood.barcode || null,
    emoji: portionFood.emoji || null,
  });
  persist();
  closeModal();
  view = 'today';
  render();
  toast(`${esc(portionFood.name)} eingetragen 🍽️`, 'success');
}

/* ─────────────────────────── Toasts ─────────────────────────── */

function toast(msg, kind = 'info') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ─────────────────────────── Daten-Im/Export ─────────────────────────── */

function exportData() {
  const blob = new Blob([store.exportJSON(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foodtracker-backup-${ymd()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup heruntergeladen ⬇️', 'success');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      state = store.importJSON(text);
      persist();
      view = 'today';
      render();
      toast('Daten importiert ✅', 'success');
    } catch (err) {
      toast('Import fehlgeschlagen: ' + err.message, 'error');
    }
  };
  input.click();
}

function resetAll() {
  if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
  store.clearAll();
  state = store.emptyState();
  view = 'profile';
  render();
  toast('Alle Daten wurden gelöscht.', 'info');
}

/* ─────────────────────────── Event-Delegation ─────────────────────────── */

function setupGlobalEvents() {
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    switch (act) {
      case 'view':
        view = btn.dataset.view;
        render();
        break;
      case 'quick-add':
        openAddSheet(mealByTime());
        break;
      case 'add':
        openAddSheet(btn.dataset.meal);
        break;
      case 'day':
        selectedDate = addDays(selectedDate, Number(btn.dataset.delta));
        if (selectedDate > ymd()) selectedDate = ymd();
        render();
        break;
      case 'week':
        weekOffset += Number(btn.dataset.delta);
        if (weekOffset > 0) weekOffset = 0;
        render();
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'del-entry': {
        const { meal, id } = btn.dataset;
        const day = getDay(selectedDate);
        day[meal] = day[meal].filter((x) => x.id !== id);
        persist();
        render();
        toast('Eintrag entfernt', 'info');
        break;
      }
      case 'save-profile':
        saveProfile();
        break;
      case 'export':
        exportData();
        break;
      case 'import':
        importData();
        break;
      case 'reset':
        resetAll();
        break;
      case 'log-weight':
        logWeight();
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'close-modal-bg':
        if (e.target === btn) closeModal();
        break;
      case 'add-tab':
        renderAddTab(btn.dataset.tab);
        break;
      case 'start-scan':
        startScanFlow();
        break;
      case 'lookup-barcode': {
        const code = document.getElementById('barcode-input').value.trim();
        if (code) handleBarcode(code);
        break;
      }
      case 'add-manual':
        addManual();
        break;
      case 'pick': {
        const kind = btn.dataset.kind;
        const i = Number(btn.dataset.i);
        let food;
        if (kind === 'recent') food = state.recent[i];
        else if (kind === 'custom') food = state.customFoods[i];
        else food = { ...COMMON_FOODS[i], source: 'local' };
        if (food) openPortion(food);
        break;
      }
      case 'pick-result': {
        const food = lastResults[Number(btn.dataset.i)];
        if (food) openPortion(food);
        break;
      }
      case 'preset':
        document.getElementById('p-unit').value = 'g';
        document.getElementById('p-amount').value = btn.dataset.g;
        updatePortionPreview();
        break;
      case 'preset-piece':
        document.getElementById('p-unit').value = 'piece';
        document.getElementById('p-amount').value = btn.dataset.n;
        updatePortionPreview();
        break;
      case 'confirm-portion':
        confirmPortion();
        break;
    }
  });

  // Modal mit Escape schließen.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Charts bei Größenänderung neu zeichnen.
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (!state.profile) return;
      if (view === 'progress') drawWeightChart();
      if (view === 'week') drawCurrentWeek();
    }, 150);
  });

  // Auf Systemwechsel hell/dunkel reagieren, solange kein manuelles Theme gesetzt ist.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const t = state.settings && state.settings.theme;
      if (t !== 'light' && t !== 'dark') {
        applyTheme();
        renderTopbar();
      }
    });
  }
}

/* ─────────────────────────── Start ─────────────────────────── */

applyTheme();
setupGlobalEvents();
render();
