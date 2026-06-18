// Responsiveness-„Lint": stellt sicher, dass die Regeln, die Mobile-Overflow
// verhindern, im CSS erhalten bleiben (Schutz gegen Regressionen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/** Body der ersten Regel zurückgeben, deren Selektor mit dem Literal beginnt. */
function ruleBody(selectorLiteral) {
  const idx = css.indexOf(selectorLiteral);
  assert.ok(idx >= 0, `Selektor fehlt im CSS: ${selectorLiteral}`);
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

test('Box-Sizing global auf border-box', () => {
  assert.match(css, /box-sizing:\s*border-box/);
});

test('html/body verhindert horizontales Scrollen', () => {
  assert.match(css, /overflow-x:\s*hidden/);
});

test('Formularfelder füllen ihre Spalte und schrumpfen (kein Overflow)', () => {
  const body = ruleBody('.field input,');
  assert.match(body, /width:\s*100%/);
  assert.match(body, /min-width:\s*0/);
  assert.match(body, /max-width:\s*100%/);
});

test('Grid-Container erlauben Schrumpfen (min-width:0)', () => {
  assert.match(ruleBody('.field {'), /min-width:\s*0/);
  assert.match(ruleBody('.grid2 {'), /min-width:\s*0/);
  assert.match(ruleBody('.portion-row {'), /min-width:\s*0/);
});

test('Gewicht-Eingabe: breites Feld + Icon-Button', () => {
  assert.match(ruleBody('.weigh-main input'), /flex:\s*1/);
  assert.ok(css.includes('.save-icon'), '.save-icon Regel fehlt');
});

test('Suchfeld ist sticky (springt beim Tippen nicht weg)', () => {
  assert.match(ruleBody('.search-bar {'), /position:\s*sticky/);
});

test('Sehr schmale Screens: Formulare werden einspaltig', () => {
  assert.match(css, /@media\s*\(max-width:\s*360px\)/);
  const idx = css.indexOf('@media (max-width: 360px)');
  const segment = css.slice(idx, idx + 400);
  assert.match(segment, /grid-template-columns:\s*1fr/);
});

test('Canvas-Diagramme sind auf 100 % begrenzt', () => {
  assert.match(ruleBody('canvas {'), /max-width:\s*100%/);
});

test('Dark-Mode-Variablen sind definiert', () => {
  assert.ok(css.includes('[data-theme="dark"]'), 'Dark-Theme-Block fehlt');
  const body = ruleBody(':root[data-theme="dark"]');
  assert.match(body, /--bg:/);
  assert.match(body, /--card:/);
  assert.match(body, /--text:/);
});
