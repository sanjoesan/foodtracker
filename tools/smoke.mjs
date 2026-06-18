// Lokaler DOM-Smoke-Test (nicht Teil der CI). Start: `node tools/smoke.mjs`
// Erfordert lokal installiertes jsdom: `npm install jsdom --no-save`
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/foodtracker/', pretendToBeVisual: true });
const { window } = dom;

// Globale Browser-APIs für die ES-Module bereitstellen.
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.confirm = () => true;

// Canvas im jsdom hat kein echtes Backend → harmloser Stub.
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get: () => 360, configurable: true });

let failures = 0;
function check(label, cond) {
  if (cond) console.log('  ✔', label);
  else {
    console.error('  x FAIL:', label);
    failures++;
  }
}
const view = () => document.getElementById('view').innerHTML;
const click = (sel) => document.querySelector(sel)?.dispatchEvent(new window.Event('click', { bubbles: true }));
const set = (id, val) => {
  const el = document.getElementById(id);
  el.value = val;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('Lade App …');
await import('../js/app.js');

console.log('Onboarding:');
check('zeigt Willkommen', view().includes('Willkommen'));
check('hat Formularfelder', !!document.getElementById('f-age'));

console.log('Profil ausfüllen & speichern:');
set('f-sex', 'male');
set('f-age', '30');
set('f-height', '180');
set('f-weight', '85');
set('f-target', '78');
set('f-activity', 'moderate');
set('f-rate', '0.5');
check('Plan-Vorschau zeigt kcal/Tag', document.getElementById('plan-preview').innerHTML.includes('kcal'));
click('[data-act="save-profile"]');
await sleep(20);

console.log('Heute-Ansicht:');
check('zeigt Kalorien-Ring/Übrig', view().includes('kcal übrig') || view().includes('Heute'));
check('zeigt Mahlzeiten', view().includes('Frühstück') && view().includes('Abendessen'));
check('Tab-Leiste vorhanden', document.getElementById('tabbar').innerHTML.includes('Fortschritt'));

console.log('Essen hinzufügen:');
click('[data-act="quick-add"]');
await sleep(10);
check('Modal mit Suche/Scan/Manuell', document.getElementById('modal-root').innerHTML.includes('Manuell'));
check('Schnellauswahl gängiger Lebensmittel', document.getElementById('modal-root').innerHTML.includes('Häufige Lebensmittel'));
// Erstes „häufiges Lebensmittel“ wählen.
click('[data-act="pick"][data-kind="common"][data-i="0"]');
await sleep(10);
check('Portionsdialog offen', document.getElementById('modal-root').innerHTML.includes('Eintragen'));
check('Portionsvorschau zeigt kcal', document.getElementById('portion-preview').innerHTML.includes('kcal'));
click('[data-act="confirm-portion"]');
await sleep(10);
check('Eintrag erscheint in Heute', view().includes('Apfel'));

console.log('Fortschritt-Ansicht:');
click('[data-act="view"][data-view="progress"]');
await sleep(20);
check('zeigt Fortschritt', view().includes('Fortschritt'));
check('Gewicht-Chart-Canvas da', view().includes('weight-chart'));
check('Prognose vorhanden', view().includes('Prognose'));

console.log('Profil-Ansicht:');
click('[data-act="view"][data-view="profile"]');
await sleep(10);
check('zeigt Profil & Daten-Aktionen', view().includes('Profil') && view().includes('exportieren'));

console.log(failures === 0 ? '\n✅ Smoke-Test bestanden.' : `\n❌ ${failures} Fehler.`);
process.exit(failures === 0 ? 0 : 1);
