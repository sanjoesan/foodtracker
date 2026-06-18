# 🥗 Foodtracker

Dein freundlicher, motivierender Begleiter zum **gesunden Abnehmen oder Zunehmen**. Setze dir ein realistisches Ziel, tracke deine Mahlzeiten per **Barcode-Scan, Suche oder manuell** und behalte Kalorien, Makros und deinen Fortschritt im Blick.

➡️ **Live:** https://sanjoesan.github.io/foodtracker/

Läuft komplett im Browser — **keine Anmeldung, kein Server, kein Tracking.** Alle Daten bleiben lokal auf deinem Gerät (`localStorage`).

## ✨ Funktionen

- **Persönlicher Plan** — Grundumsatz (Mifflin-St-Jeor) & Gesamtumsatz aus Geschlecht, Alter, Größe, Gewicht und Aktivität. Daraus dein tägliches Kalorienziel.
- **Gesunde Grenzen** 💚 — das Abnehm-/Zunehmtempo ist auf gesunde Werte gedeckelt (max. ~1 % Körpergewicht bzw. 1 kg/Woche), Kalorien fallen nie unter sichere Mindestwerte (1200/1500 kcal), plus BMI-Warnungen.
- **Realistische Zeitspanne** ⏱️ — ehrliche Prognose, wann du dein Ziel erreichst.
- **Food-Tracking** — Frühstück, Mittag, Abendessen & Snacks, Menge in **Gramm/ml oder Stück**.
- **Offlinesuche** 🔎 — eingebaute Datenbank mit **über 1.170 recherchierten Lebensmitteln** (Obst, Gemüse, Brot, Fleisch, Wurst & Schinken, Fisch, Käse, Joghurt, Kuchen & Torten, Desserts, Suppen, Vorspeisen, Hauptgerichte, Getränke u. v. m.) – sofort, ohne Internet, umlauttolerant. Standard-Tab beim Hinzufügen.
- **Barcode-Scanner** 📷 — Kamera-Scan (native `BarcodeDetector`-API mit ZXing-Fallback) oder manuelle EAN-Eingabe.
- **Onlinesuche** 🌐 — Millionen Markenprodukte über die [Open Food Facts](https://world.openfoodfacts.org)-Datenbank. Tipp-Verzögerung (Debounce) + Ergebnis-Cache schonen das API-Limit. Klare Meldungen: „keine Treffer" vs. „überlastet" vs. „nicht erreichbar".
- **Makro-Tracking** — Eiweiß, Kohlenhydrate, Fett mit Tageszielen.
- **Wochenstatistiken** 📊 — Balkendiagramm der letzten 7 Tage, Ø Kalorien & Makros, „Tage im Plan", Wochen-Navigation und Gewichtsänderung der Woche.
- **Dark Mode** 🌙 — heller/dunkler Modus, folgt standardmäßig der Systemeinstellung, per Tipp umschaltbar.
- **Fortschritt** 📈 — Gewichtsverlauf-Diagramm, Fortschrittsbalken, Tages-Serie (Streak) und motivierende Nachrichten.
- **Backup** — Daten als JSON exportieren/importieren.
- **PWA** — installierbar, mobil-optimiert.

## 🧮 Wie wird gerechnet?

| Größe | Formel |
| --- | --- |
| Grundumsatz (BMR) | Mifflin-St-Jeor |
| Gesamtumsatz (TDEE) | BMR × Aktivitätsfaktor (1,2–1,9) |
| Kalorienziel | TDEE ∓ (Tempo × 7700 kcal / 7) |
| Zeitspanne | Differenz zum Zielgewicht ÷ effektives Wochentempo |

> ⚠️ Dies ist **keine medizinische Beratung**. Bei gesundheitlichen Fragen oder besonderen Bedürfnissen sprich bitte mit Fachpersonal.

## 🚀 Lokal starten

Reines HTML/CSS/JS, kein Build nötig. Wegen ES-Modulen einen kleinen Server nutzen:

```bash
npx serve .
# oder
python -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Für den Kamera-Scanner ist HTTPS oder `localhost` erforderlich.

## ✅ Tests

```bash
npm run check   # Syntax-Check aller Module
npm test        # Tests der Berechnungslogik
```

## 🛠️ Technik

Vanilla JavaScript (ES-Module), keine Frameworks, keine Build-Pipeline. Deployment über GitHub Pages.

- `index.html`, `styles.css` — Oberfläche
- `js/calc.js` — Berechnungen & Gesundheits-Guards
- `js/api.js` — Open-Food-Facts-Anbindung
- `js/scanner.js` — Barcode-Scan
- `js/db.js` — Offline-Suche (tolerant, indexiert)
- `js/foods-data.js` — Offline-Datenbank (~1.180 Lebensmittel, je 100 g/ml)
- `js/stats.js` — Wochenstatistik-Aggregation
- `js/storage.js` — lokale Speicherung
- `js/app.js` — Steuerung & UI

Getestet mit dem Node-Test-Runner: Logik-Tests (`calc`, `stats`), API-Tests mit gemocktem `fetch` (`api`), CSS-Responsiveness-Lint und ein vollständiger DOM-Integrationstest (jsdom) — alles läuft in CI.

## 📓 Changelog

Alle Änderungen sind in [CHANGELOG.md](CHANGELOG.md) dokumentiert. Aktuell: **v1.2.0**.

## 📄 Lizenz

MIT. Lebensmitteldaten von Open Food Facts unter der [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
