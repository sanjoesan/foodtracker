# Changelog

Alle nennenswerten Änderungen an diesem Projekt. Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach
[SemVer](https://semver.org/lang/de/).

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

[1.1.0]: https://github.com/sanjoesan/foodtracker/releases/tag/v1.1.0
[1.0.0]: https://github.com/sanjoesan/foodtracker/releases/tag/v1.0.0
