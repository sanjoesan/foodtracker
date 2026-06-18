// scanner.js — Barcode-Scannen über die Kamera.
// Strategie:
//   1) Native BarcodeDetector-API (Chrome/Edge/Android) — schnell & ohne Download.
//   2) Fallback: ZXing per CDN nachladen (Safari/Firefox).
//   3) Wenn nichts geht: manuelle Eingabe (in der UI).

const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

/** Prüft, ob die native API verfügbar ist. */
export function hasNativeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/** Prüft, ob überhaupt eine Kamera angesprochen werden kann. */
export function hasCamera() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Startet das Scannen in ein <video>-Element.
 * @param {HTMLVideoElement} videoEl
 * @param {(code:string)=>void} onResult  — wird einmalig beim ersten Treffer aufgerufen
 * @returns {Promise<{stop:()=>void}>}  — Controller zum Beenden
 */
export async function startScan(videoEl, onResult) {
  if (!hasCamera()) throw new Error('Kein Kamerazugriff in diesem Browser möglich.');

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', 'true');
  await videoEl.play();

  let stopped = false;
  let rafId = null;
  let zxingReader = null;
  let zxingControls = null;

  const stop = () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    try {
      if (zxingControls && zxingControls.stop) zxingControls.stop();
      if (zxingReader && zxingReader.reset) zxingReader.reset();
    } catch (_) {
      /* egal */
    }
    stream.getTracks().forEach((tr) => tr.stop());
    videoEl.srcObject = null;
  };

  const finish = (code) => {
    if (stopped) return;
    stop();
    onResult(code);
  };

  if (hasNativeDetector()) {
    const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
    const tick = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes && codes.length) {
          finish(codes[0].rawValue);
          return;
        }
      } catch (_) {
        /* einzelne Frames können fehlschlagen — einfach weiter */
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } else {
    // ZXing als Fallback laden (Safari/Firefox ohne BarcodeDetector).
    let ZXing;
    try {
      ZXing = await import(/* @vite-ignore */ ZXING_CDN);
    } catch (e) {
      throw new Error('Scanner-Bibliothek konnte nicht geladen werden. Bitte Barcode manuell eingeben.');
    }
    const Reader = ZXing.BrowserMultiFormatReader;
    zxingReader = new Reader();
    const onZX = (result) => {
      if (result) finish(result.getText ? result.getText() : result.text);
    };
    try {
      // Verschiedene API-Varianten defensiv abdecken.
      if (typeof zxingReader.decodeFromStream === 'function') {
        zxingControls = await zxingReader.decodeFromStream(stream, videoEl, (res) => res && onZX(res));
      } else if (typeof zxingReader.decodeFromVideoElement === 'function') {
        zxingControls = await zxingReader.decodeFromVideoElement(videoEl, (res) => res && onZX(res));
      } else {
        zxingControls = await zxingReader.decodeFromVideoDevice(undefined, videoEl, (res) => res && onZX(res));
      }
    } catch (e) {
      stop();
      throw new Error('Scanner konnte nicht gestartet werden. Bitte Barcode manuell eingeben.');
    }
  }

  return { stop };
}
