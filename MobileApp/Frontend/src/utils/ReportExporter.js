import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import { Platform } from 'react-native';
import { formatMsToTime } from './EcgAnalysis';
import { generateBpmTrendSvg, generateActivityTrendSvg, generateEcgStripSvg } from './SvgCharts';

export const buildNoiseCsvContent = (trendData) => {
  if (!trendData || trendData.length === 0) return '';
  const header = 'Timestamp_ms,ECG_raw,BPM,Lead_off,Activity,Important,Noise\n';
  const body = trendData.map(t => `${t.originalLine},${t.isNoise ? 1 : 0}`).join('\n');
  return header + body;
};

export const saveToDownloads = async (trendData, showToast) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  try {
    if (!trendData || trendData.length === 0) { showToast('Brak danych do udostępnienia.', 'error'); return; }
    const EXPORT_URI = FileSystem.cacheDirectory + `badanie_EKG_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(EXPORT_URI, buildNoiseCsvContent(trendData), { encoding: FileSystem.EncodingType.UTF8 });
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) { showToast('Udostępnianie niedostępne na tym urządzeniu.', 'error'); return; }
    await Sharing.shareAsync(EXPORT_URI, { mimeType: 'text/csv', dialogTitle: 'Zapisz badanie EKG z analizą szumów', UTI: 'public.comma-separated-values-text' });
    await FileSystem.deleteAsync(EXPORT_URI, { idempotent: true });
  } catch (error) {
    console.error('Błąd zapisu:', error);
    showToast('Nie udało się wygenerować pliku z szumami.', 'error');
  }
};

export const generatePdfReport = async (reportData, mode = 'share', emailData = null, showToast) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  try {
    if (!reportData) { showToast('Brak danych do wygenerowania raportu PDF.', 'error'); return; }

    const tachyRows = (reportData.tachyDetails || []).slice(0, 10).map((d, i) => `<tr><td>Epizod #${i + 1}</td><td>${formatMsToTime(d.start)}</td><td>${formatMsToTime(d.end)}</td><td>${Math.round((d.end - d.start) / 1000)}s</td><td>${d.maxBpm} BPM</td></tr>`).join('');
    const bradyRows = (reportData.bradyDetails || []).slice(0, 10).map((d, i) => `<tr><td>Epizod #${i + 1}</td><td>${formatMsToTime(d.start)}</td><td>${formatMsToTime(d.end)}</td><td>${Math.round((d.end - d.start) / 1000)}s</td><td>${d.minBpm} BPM</td></tr>`).join('');
    const importantRows = (reportData.importantDetails || []).map((d, i) => `<tr><td>Zdarzenie #${i + 1}</td><td>${formatMsToTime(d.start)}</td><td>${formatMsToTime(d.end)}</td><td>${Math.round((d.end - d.start) / 1000)}s</td><td>${d.maxBpm || '--'} BPM</td></tr>`).join('');
    const findingsHtml = (reportData.findings || []).map(f => `<li>${f}</li>`).join('');
    const hiddenTachy = Math.max(0, (reportData.tachyDetails || []).length - 10);
    const hiddenBrady = Math.max(0, (reportData.bradyDetails || []).length - 10);

    const llmReportsHtml = (reportData.llmReports || []).map((entry, idx) => {
      const meta = entry._meta || {};
      const ts = meta.timestamp ? (() => { try { return new Date(meta.timestamp).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return meta.timestamp; } })() : '--';
      const model = [meta.providerLabel, meta.model].filter(Boolean).join(' / ') || 'AI';
      const findingsList = Array.isArray(entry.findings) && entry.findings.length ? `<ul class="findings">${entry.findings.map(f => `<li>${f}</li>`).join('')}</ul>` : '';
      const rec = entry.recommendation ? `<div class="recommendation" style="margin-top:8px;">${entry.recommendation}</div>` : '';
      return `<div class="keep-together" style="margin-bottom:16px;padding:12px 14px;border:1px solid #c4b5fd;border-radius:6px;background:#faf8ff;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-weight:bold;font-size:10.5pt;color:#4338ca;">Analiza AI #${idx + 1}</span><span style="font-size:8.5pt;color:#888;">${model} &bull; ${ts}</span></div>${entry.summary ? `<p style="margin:0 0 8px;font-size:10.5pt;line-height:1.55;">${entry.summary}</p>` : ''}${findingsList}${rec}</div>`;
    }).join('');

    const bpmChartSvg = generateBpmTrendSvg(reportData.hourlyTrend);
    const activityChartSvg = generateActivityTrendSvg(reportData.hourlyTrend);
    const eventComments = reportData.eventComments || {};
    const snippetsHtml = (reportData.snippets || []).map((s, i) => {
      const ecgSvg = generateEcgStripSvg(s.data);
      if (!ecgSvg) return '';
      const comment = eventComments[i];
      return `<div style="margin:12px 0;padding:8px;border:1px solid #e0e0e0;border-radius:6px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span style="font-weight:bold;font-size:12px;color:#333;">${s.title}</span><span style="font-size:11px;color:#666;">${s.time || ''} &mdash; HR: ${s.hr || '--'} bpm</span></div>${ecgSvg}${comment ? `<div style="margin-top:6px;padding:6px 10px;background:#f5f5ff;border-left:3px solid #818cf8;border-radius:4px;"><span style="font-size:10px;color:#666;font-weight:bold;text-transform:uppercase;">Komentarz pacjenta:</span><p style="margin:2px 0 0;font-size:11px;color:#444;">${comment}</p></div>` : ''}</div>`;
    }).join('');

    const formattedDate = reportData.date ? (() => { try { return new Date(reportData.date).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return reportData.date; } })() : '--';
    const generatedAt = (() => { try { return new Date().toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return new Date().toISOString(); } })();

    const html = buildReportHtml({ reportData, formattedDate, generatedAt, bpmChartSvg, activityChartSvg, tachyRows, bradyRows, importantRows, hiddenTachy, hiddenBrady, findingsHtml, snippetsHtml, llmReportsHtml });

    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) win.addEventListener('load', () => { win.focus(); win.print(); });
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Raport otwarty — użyj "Zapisz jako PDF" w oknie drukowania.', 'info');
      return;
    }

    const { uri } = await Print.printToFileAsync({ html });
    const safeUri = FileSystem.cacheDirectory + `Raport_EKG_${Date.now()}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: safeUri });

    if (mode === 'email') {
      try {
        const isAvailable = await MailComposer.isAvailableAsync();
        if (!isAvailable) {
          showToast('Brak klienta poczty. Otwieram menu udostępniania...', 'info');
          await Sharing.shareAsync(safeUri, { mimeType: 'application/pdf', dialogTitle: 'Udostępnij raport EKG', UTI: 'com.adobe.pdf' });
        } else {
          await MailComposer.composeAsync({ recipients: [emailData.doctorEmail], subject: `Wynik badania EKG - ${reportData.date ? new Date(reportData.date).toLocaleDateString('pl-PL') : ''}`, body: emailData.message, attachments: [safeUri] });
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      } catch (err) {
        console.warn('Błąd poczty: ', err);
        await Sharing.shareAsync(safeUri, { mimeType: 'application/pdf', dialogTitle: 'Udostępnij raport EKG', UTI: 'com.adobe.pdf' });
      }
    } else {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) { showToast('Udostępnianie niedostępne na tym urządzeniu.', 'error'); return; }
      await Sharing.shareAsync(safeUri, { mimeType: 'application/pdf', dialogTitle: 'Zapisz raport EKG w formacie PDF', UTI: 'com.adobe.pdf' });
    }

    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.error('Błąd generowania PDF:', error);
    showToast('Nie udało się wygenerować pliku PDF.', 'error');
  }
};


function buildReportHtml({ reportData, formattedDate, generatedAt, bpmChartSvg, activityChartSvg, tachyRows, bradyRows, importantRows, hiddenTachy, hiddenBrady, findingsHtml, snippetsHtml, llmReportsHtml }) {
  return `<html lang="pl"><head><meta charset="utf-8"/>
  <style>
    @page { margin: 18mm 15mm; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; }
    .header { border-bottom: 3px solid #6366f1; padding-bottom: 10px; margin-bottom: 14px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 22pt; font-weight: bold; color: #6366f1; letter-spacing: 1px; }
    .brand-sub { font-size: 9pt; color: #888; margin-top: 1px; }
    .report-meta { text-align: right; font-size: 9pt; color: #666; }
    .report-meta strong { color: #333; }
    h2 { font-size: 12pt; font-weight: bold; color: #4338ca; margin: 18px 0 6px; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 6px 0 10px; }
    .stat { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f2f2f2; font-size: 10pt; }
    .stat-label { color: #555; } .stat-value { font-weight: bold; color: #111; } .stat-sub { font-size: 8.5pt; color: #888; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 10pt; }
    thead th { background: #f0f0ff; color: #4338ca; text-align: left; padding: 5px 8px; font-size: 9.5pt; border-bottom: 2px solid #c7d2fe; }
    tbody td { padding: 4px 8px; border-bottom: 1px solid #eee; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    .table-note { font-size: 9pt; color: #888; margin: -4px 0 8px; font-style: italic; }
    ul.findings { padding-left: 18px; margin: 4px 0; }
    ul.findings li { margin-bottom: 4px; font-size: 10.5pt; line-height: 1.55; }
    .recommendation { background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 5px; padding: 10px 14px; margin: 6px 0; font-size: 10.5pt; color: #3730a3; line-height: 1.55; }
    .summary-box { background: #f8faff; border-left: 4px solid #6366f1; padding: 10px 14px; border-radius: 0 5px 5px 0; margin: 6px 0 10px; font-size: 10.5pt; line-height: 1.6; }
    .chart-caption { font-size: 9pt; color: #888; text-align: center; margin: 2px 0 12px; }
    .footer { border-top: 1px solid #ddd; padding-top: 8px; margin-top: 24px; text-align: center; font-size: 8.5pt; color: #aaa; }
    .page-break { page-break-before: always; }
    .keep-together { page-break-inside: avoid; }
    .no-data { color: #aaa; font-style: italic; font-size: 10pt; }
  </style></head><body>
  <div class="header"><div class="header-top"><div><div class="brand">RYTHMIO</div><div class="brand-sub">Ambulatoryjny Holter EKG</div></div>
  <div class="report-meta"><div><strong>Data badania:</strong> ${formattedDate}</div><div><strong>Wygenerowano:</strong> ${generatedAt}</div><div><strong>Czas trwania:</strong> ${reportData.duration || '--'}</div></div></div></div>
  ${reportData.summary ? `<h2>Podsumowanie kliniczne</h2><div class="summary-box">${reportData.summary}</div>` : ''}
  <h2>Parametry badania</h2>
  <div class="stats-grid">
    <div class="stat"><span class="stat-label">Liczba zespołów QRS:</span><span class="stat-value">${(reportData.totalBeats || 0).toLocaleString('pl-PL')}</span></div>
    <div class="stat"><span class="stat-label">Średnie tętno:</span><span class="stat-value">${reportData.avgBpm || 0} BPM</span></div>
    <div class="stat"><span class="stat-label">Tętno minimalne:</span><span class="stat-value">${reportData.minBpm || 0} BPM ${reportData.minBpmTime ? `<span class="stat-sub">(godz. ${reportData.minBpmTime})</span>` : ''}</span></div>
    <div class="stat"><span class="stat-label">Tętno maksymalne:</span><span class="stat-value">${reportData.maxBpm || 0} BPM ${reportData.maxBpmTime ? `<span class="stat-sub">(godz. ${reportData.maxBpmTime})</span>` : ''}</span></div>
    <div class="stat"><span class="stat-label">Epizody tachykardii:</span><span class="stat-value">${reportData.tachyEpisodes || 0}</span></div>
    <div class="stat"><span class="stat-label">Epizody bradykardii:</span><span class="stat-value">${reportData.bradyEpisodes || 0}</span></div>
    <div class="stat"><span class="stat-label">Zdarzenia pacjenta:</span><span class="stat-value">${reportData.importantDetails?.length || 0}</span></div>
    <div class="stat"><span class="stat-label">Rozpiętość tętna:</span><span class="stat-value">${(reportData.maxBpm || 0) - (reportData.minBpm || 0)} BPM</span></div>
  </div>
  ${bpmChartSvg ? `<div class="keep-together"><h2>Trend tętna</h2>${bpmChartSvg}<div class="chart-caption">Tętno (BPM) w czasie trwania badania</div></div>` : ''}
  ${activityChartSvg ? `<div class="keep-together"><h2>Trend aktywności</h2>${activityChartSvg}<div class="chart-caption">Poziom aktywności ruchowej pacjenta</div></div>` : ''}
  ${tachyRows ? `<div class="keep-together"><h2>Epizody tachykardii (≥100 BPM przez ≥30 s)</h2><table><thead><tr><th>#</th><th>Początek</th><th>Koniec</th><th>Czas trwania</th><th>Maks. BPM</th></tr></thead><tbody>${tachyRows}</tbody></table>${hiddenTachy > 0 ? `<p class="table-note">+ ${hiddenTachy} kolejnych epizodów niewyświetlonych</p>` : ''}</div>` : ''}
  ${bradyRows ? `<div class="keep-together"><h2>Epizody bradykardii (&lt;50 BPM przez ≥30 s)</h2><table><thead><tr><th>#</th><th>Początek</th><th>Koniec</th><th>Czas trwania</th><th>Min. BPM</th></tr></thead><tbody>${bradyRows}</tbody></table>${hiddenBrady > 0 ? `<p class="table-note">+ ${hiddenBrady} kolejnych epizodów niewyświetlonych</p>` : ''}</div>` : ''}
  ${importantRows ? `<div class="keep-together"><h2>Zdarzenia oznaczone przez pacjenta</h2><table><thead><tr><th>#</th><th>Początek</th><th>Koniec</th><th>Czas trwania</th><th>BPM</th></tr></thead><tbody>${importantRows}</tbody></table></div>` : ''}
  ${snippetsHtml ? `<h2>Reprezentatywne wycinki EKG</h2>${snippetsHtml}` : ''}
  ${findingsHtml ? `<div class="keep-together"><h2>Szczegółowe wnioski kliniczne</h2><ul class="findings">${findingsHtml}</ul></div>` : ''}
  ${reportData.recommendation ? `<div class="keep-together"><h2>Zalecenia (analiza algorytmiczna)</h2><div class="recommendation">${reportData.recommendation}</div></div>` : ''}
  ${llmReportsHtml ? `<div class="page-break"><h2>Analizy AI</h2>${llmReportsHtml}</div>` : ''}
  <div class="footer">Wygenerowano przez Rythmio Holter EKG &bull; Raport ma charakter informacyjny i nie zastępuje diagnozy ani konsultacji lekarskiej.</div>
  </body></html>`;
}
