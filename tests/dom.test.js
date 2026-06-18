// Echter DOM-Integrationstest mit jsdom: spielt den kompletten Nutzerfluss durch
// (Onboarding → Theme → Profil → Essen → Woche → Fortschritt → Profil).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/foodtracker/', pretendToBeVisual: true });
const { window } = dom;

// Browser-Globals für die ES-Module bereitstellen (navigator ist in Node read-only → auslassen).
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.confirm = () => true;

// Canvas hat in jsdom kein Backend → harmloser Stub; feste Breite für Layout-abhängigen Code.
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get: () => 360, configurable: true });

const view = () => document.getElementById('view').innerHTML;
const modal = () => document.getElementById('modal-root').innerHTML;
const click = (sel) => document.querySelector(sel)?.dispatchEvent(new window.Event('click', { bubbles: true }));
const set = (id, val) => {
  const el = document.getElementById(id);
  el.value = val;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await import('../js/app.js');

test('Foodtracker-Nutzerfluss', async (t) => {
  await t.test('Onboarding wird angezeigt', () => {
    assert.ok(view().includes('Willkommen'));
    assert.ok(document.getElementById('f-age'));
  });

  await t.test('Theme-Toggle wechselt hell/dunkel', () => {
    const before = document.documentElement.dataset.theme;
    click('[data-act="toggle-theme"]');
    const after = document.documentElement.dataset.theme;
    assert.notEqual(before, after);
    assert.ok(after === 'light' || after === 'dark');
    click('[data-act="toggle-theme"]'); // zurück
  });

  await t.test('Plan-Vorschau erscheint beim Ausfüllen', () => {
    set('f-sex', 'male');
    set('f-age', '30');
    set('f-height', '180');
    set('f-weight', '85');
    set('f-target', '78');
    set('f-activity', 'moderate');
    set('f-rate', '0.5');
    assert.match(document.getElementById('plan-preview').innerHTML, /kcal/);
  });

  await t.test('Profil speichern führt zur Heute-Ansicht', async () => {
    click('[data-act="save-profile"]');
    await sleep(20);
    assert.ok(view().includes('Frühstück') && view().includes('Abendessen'));
    assert.ok(document.getElementById('tabbar').innerHTML.includes('Woche'));
  });

  await t.test('Essen über Schnellauswahl hinzufügen', async () => {
    click('[data-act="quick-add"]');
    await sleep(10);
    assert.ok(modal().includes('Häufige Lebensmittel'));
    click('[data-act="pick"][data-kind="common"][data-i="0"]');
    await sleep(10);
    assert.ok(modal().includes('Eintragen'));
    assert.match(document.getElementById('portion-preview').innerHTML, /kcal/);
    click('[data-act="confirm-portion"]');
    await sleep(10);
    assert.ok(view().includes('Apfel'));
  });

  await t.test('Woche-Ansicht zeigt Diagramm und Kennzahlen', async () => {
    click('[data-act="view"][data-view="week"]');
    await sleep(20);
    assert.ok(view().includes('week-chart'));
    assert.ok(view().includes('Tage protokolliert'));
    assert.ok(view().includes('Makros pro Tag'));
  });

  await t.test('Fortschritt: Gewicht-Button ist ein Symbol (kein Text „Speichern")', async () => {
    click('[data-act="view"][data-view="progress"]');
    await sleep(20);
    assert.ok(view().includes('weight-chart'));
    const saveBtn = document.querySelector('[data-act="log-weight"]');
    assert.ok(saveBtn, 'Speichern-Button fehlt');
    assert.equal(/Speichern/.test(saveBtn.textContent), false);
    assert.ok(document.getElementById('w-kg'), 'Gewichtsfeld fehlt');
  });

  await t.test('Gewicht eintragen aktualisiert die Ansicht', async () => {
    set('w-kg', '84.5');
    click('[data-act="log-weight"]');
    await sleep(20);
    assert.ok(view().includes('84,5') || view().includes('84.5'));
  });

  await t.test('Profil-Ansicht mit Daten-Aktionen', async () => {
    click('[data-act="view"][data-view="profile"]');
    await sleep(10);
    assert.ok(view().includes('exportieren'));
  });
});
