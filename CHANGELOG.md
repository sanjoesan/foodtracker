# Changelog

Alle nennenswerten Änderungen an diesem Projekt. Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach
[SemVer](https://semver.org/lang/de/).

## [1.2.0] – 2026-06-18

### Hinzugefügt

- **Große Offline-Datenbank** 🔎 — `js/foods-data.js` mit **über 1.170 recherchierten
  Lebensmitteln** (Nährwerte je 100 g/ml) über 21 Kategorien: Obst, Gemüse, Brot &
  Backwaren, Getreide & Beilagen, Cerealien, Fleisch & Geflügel, Wurst & Schinken,
  Fisch & Meeresfrüchte, Eier, Hülsenfrüchte, Fleischersatz, Milchprodukte, Käse,
  Süßes & Desserts (Kuchen, Torten, Eis …), Snacks, Fette & Nüsse, Saucen & Dips,
  Suppen & Eintöpfe, Vorspeisen, Hauptgerichte, Getränke. Werte recherchiert (USDA,
  fddb.info, naehrwertrechner.de) und validiert (kcal ≈ 4·EW + 4·KH + 9·Fett,
  Duplikate entfernt). Tolerante Suche (umlaut-/akzentunabhängig) in `js/db.js`.

### Geändert

- **Hinzufügen-Dialog neu sortiert**: **Offlinesuche** (mit Suchfeld über die große
  Datenbank) ist jetzt der erste Tab und Standard, **Onlinesuche** (Open Food Facts)
  der letzte. Dazwischen Scan und Manuell.
- Die feste Chip-Liste „Häufige Lebensmittel" entfällt — stattdessen durchsucht man
  die komplette Offline-Datenbank. „Zuletzt verwendet" und „Eigene Lebensmittel"
  bleiben als Schnellauswahl im Offline-Tab.
- Onlinesuche zeigt nur noch echte Open-Food-Facts-Treffer (keine lokalen mehr
  beigemischt) und verweist bei Bedarf auf die Offline-Suche.

### Tests

- Neue `tests/db.test.js` (Größe, Pflichtfelder, keine Duplikate, Plausibilität,
  Kategorienabdeckung, tolerante Suche). DOM-Test auf die neuen Tabs angepasst.
  Insgesamt 53 Tests grün.

## [1.1.0] – 2026-06-18

### Hinzugefügt

- **Dark Mode** 🌙 — heller/dunkler Modus über CSS-Variablen, Umschalter in der
  Topbar. Folgt standardmäßig der Systemeinstellung (`prefers-color-scheme`),
  manuelle Wahl wird gespeichert. Auch die Diagramme passen ihre Farben an.
- **Wochenstatistiken** 📊 — neuer Tab „Woche" mit 7-Tage-Balkendiagramm
  (grün = im Plan, orange = über/unter Ziel, gestrichelte Ziel-Linie),
  Ø Kalorien & Makros pro Tag, „Tage im Plan", Wochen-Navigation und
  Gewichtsänderung der Woche. Eigenes Modul `js/stats.js` (reine, testbare Logik).

### Geändert / Behoben

- **Mobile-Responsiveness** — Eingabefelder liefen auf schmalen Screens über und
  waren zu schmal. Alle Inputs/Selects nutzen jetzt `width:100% + min-width:0`,
  Grids dürfen schrumpfen, `overflow-x` ist abgesichert, sehr schmale Screens
  (< 360 px) werden einspaltig.
- **„Gewicht eintragen"** — breites Gewichtsfeld + Datum darunter; der
  „Speichern"-Text wurde durch ein ✓-Symbol ersetzt.
- **Hinzufügen-Dialog springt nicht mehr** — das bodenverankerte Sheet hatte
  inhaltsabhängige Höhe und sprang beim Tippen / Tabwechsel. Jetzt feste Höhe
  (`min(88vh, 700px)`), der Inhalt scrollt intern. Mit echtem Chrome (headless)
  auf Desktop und Smartphone-Viewport verifiziert: 0 px Schwankung.
- **Textsuche robuster** — Debounce auf 600 ms erhöht und „Suche…"-Status erst
  beim tatsächlichen Senden (nicht pro Tastendruck); Ergebnis-Cache pro
  Suchbegriff; laufende Anfragen werden bei neuer Eingabe abgebrochen. Das
  schont das strenge API-Limit von Open Food Facts.
- **Klare Suchmeldungen** — „keine Treffer" (Tippfehler), „Datenbank überlastet"
  (Rate-Limit 429 / 5xx) und „nicht erreichbar" (offline) werden sauber
  unterschieden statt pauschal „nicht erreichbar".
- **Scanner** — `navigator` wird defensiv per `typeof` geprüft (verhinderte
  einen Fehler in Test-Umgebungen ohne globales `navigator`).

### Tests / CI

- Test-Suite erweitert auf **45 Tests**: Berechnungslogik (`calc`),
  Wochenstatistik (`stats`), API mit gemocktem `fetch` (`api`),
  CSS-Responsiveness-Lint und ein vollständiger jsdom-DOM-Integrationstest.
- `jsdom` als devDependency, `package-lock.json`, CI nutzt `npm ci`.

## [1.0.0] – 2026-06-18

### Erstveröffentlichung

- Persönlicher Plan: Grundumsatz (Mifflin-St-Jeor), Gesamtumsatz, Tageskalorienziel.
- Gesundheits-Guards: Tempo-Deckelung (max. ~1 %/Woche bzw. 1 kg), Kalorien-
  Untergrenzen (1200/1500 kcal), BMI-Warnungen, realistische Zeitprognose.
- Food-Tracking (Frühstück/Mittag/Abend/Snacks), Menge in g/ml/Stück.
- Barcode-Scan (`BarcodeDetector` + ZXing-Fallback) und manuelle EAN-Eingabe.
- Textsuche via Open Food Facts + eingebaute Offline-Lebensmittel.
- Makro-Tracking, Gewichtsverlauf-Diagramm, Fortschrittsbalken, Tages-Serie,
  motivierende Nachrichten.
- Daten lokal (`localStorage`), JSON-Import/-Export, PWA.
- Vanilla JS (ES-Module, kein Build), Deployment über GitHub Pages.

[1.2.0]: https://github.com/sanjoesan/foodtracker/releases/tag/v1.2.0
[1.1.0]: https://github.com/sanjoesan/foodtracker/releases/tag/v1.1.0
[1.0.0]: https://github.com/sanjoesan/foodtracker/releases/tag/v1.0.0
