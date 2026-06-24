/**
 * PdfBuilder — generowanie PDF z raportu AI (zastępuje serwer Python /generate_pdf)
 *
 * Layout identyczny z serwerem Python:
 *   - Tytuł "RAPORT EKG" (bold, centered)
 *   - Timestamp
 *   - Linia indigo (#6366f1)
 *   - Sekcja "Podsumowanie kliniczne"
 *   - "Szczegółowe wnioski" z bulletami
 *   - "Zalecenia" w pudełku (bg #f5f3ff, border #818cf8)
 *   - Watermark logo (8% opacity, indigo tint) — native only
 *   - Stopka z disclaimerem
 *
 * Używa expo-print (już w projekcie).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

async function getLogoUri() {
  if (Platform.OS === 'web') return null; // web nie obsługuje lokalnych URI w iframe print
  try {
    const asset = Asset.fromModule(require('../../assets/logo.png'));
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri ?? null;
  } catch {
    return null;
  }
}

// ─── HTML template ───────────────────────────────────────────────────────────

function buildHtml({ summary, findings, recommendation, timestamp, logoUri }) {
  const watermark = logoUri
    ? `<img src="${logoUri}" class="wm" alt=""/>`
    : '';

  const findingsHtml = (findings ?? []).length > 0
    ? `<section>
        <h2>Szczegółowe wnioski</h2>
        <ul class="findings">
          ${(findings).map(f => `<li>${esc(f)}</li>`).join('')}
        </ul>
       </section>`
    : '';

  const recHtml = recommendation
    ? `<section class="rec-box">
        <p class="rec-title">Zalecenia</p>
        <p class="rec-text">${esc(recommendation)}</p>
       </section>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  @page { margin: 20mm 15mm; }
  body  { font-family: Helvetica, Arial, sans-serif; color: #111; font-size: 11pt; }
  .wm  { position: fixed; top: 50%; left: 50%;
         transform: translate(-50%,-50%);
         opacity: 0.08; filter: sepia(1) saturate(5) hue-rotate(220deg);
         width: 300px; z-index: -1; }
  h1   { text-align: center; font-size: 26pt; margin: 0 0 4px; }
  .ts  { text-align: center; font-size: 10pt; color: #555; margin: 0 0 8px; }
  hr.d { border: none; border-top: 2px solid #6366f1; margin: 10px 0 20px; }
  h2   { font-size: 14pt; margin: 16px 0 8px; }
  p    { line-height: 1.55; margin: 0 0 4px; }
  ul.findings { line-height: 1.7; padding-left: 20px; margin: 0 0 4px; }
  section { page-break-inside: avoid; margin-bottom: 12px; }
  .rec-box  { background: #f5f3ff; border: 1px solid #818cf8; border-radius: 6px;
              padding: 12px 16px; margin-top: 16px; page-break-inside: avoid; }
  .rec-title{ color: #4f46e5; font-weight: bold; font-size: 11pt; margin: 0 0 8px; }
  .rec-text { font-size: 10pt; line-height: 1.5; margin: 0; }
  hr.f { border: none; border-top: 1px solid #ccc; margin: 24px 0 8px; }
  .footer{ text-align: center; font-size: 8pt; color: #999; }
</style></head><body>
  ${watermark}
  <h1>RAPORT EKG</h1>
  <p class="ts">Wygenerowano: ${timestamp}</p>
  <hr class="d"/>
  ${summary ? `<section><h2>Podsumowanie kliniczne</h2><p>${esc(summary)}</p></section>` : ''}
  ${findingsHtml}
  ${recHtml}
  <hr class="f"/>
  <p class="footer">Wygenerowano przez Rythmio &nbsp;|&nbsp; Raport ma charakter informacyjny i nie zastępuje diagnozy lekarskiej.</p>
</body></html>`;
}

// ─── Publiczne API ───────────────────────────────────────────────────────────

/**
 * Wygeneruj PDF z danych AI i otwórz system share-sheet.
 * @param {{ summary: string, findings: string[], recommendation: string }} parsed  — odpowiedź modelu
 * @param {object} _record  — activeReportRecord (zarezerwowane na przyszłe metadane)
 * @returns {Promise<string>} URI wygenerowanego pliku PDF
 */
export async function generate(parsed, _record) {
  // Na webie expo-print nie obsługuje printToFileAsync — pomijamy generowanie PDF.
  // Analiza AI jest widoczna w UI; PDF dostępny na urządzeniu mobilnym.
  if (Platform.OS === 'web') return null;

  const { summary = '', findings = [], recommendation = '' } = parsed ?? {};

  const now = new Date();
  let timestamp;
  try {
    timestamp = now.toLocaleString('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    const pad = (n) => String(n).padStart(2, '0');
    timestamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  const logoUri = await getLogoUri();
  const html = buildHtml({ summary, findings, recommendation, timestamp, logoUri });

  const result = await Print.printToFileAsync({ html, base64: false });
  const uri = result?.uri;
  if (!uri) return null;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Zapisz lub udostępnij raport EKG',
    });
  }

  return uri;
}
