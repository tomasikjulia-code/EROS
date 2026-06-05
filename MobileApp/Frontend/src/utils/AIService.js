import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_URL = 'http://192.168.1.18:8000';

export const sendPrompt = async (prompt) => {
  try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        });
        const data = await response.json();
        console.log("Response:", data.response);
        return data.response;
    } catch (error) {
        console.error('Error:', error);
    }
};

export const getReport = async (aiResponse) => {
  try {
    const response = await fetch(`${API_URL}/generate_pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiResponse }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte), ''
      )
    );

    const fileUri = FileSystem.cacheDirectory + 'RaportAI.pdf';
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('PDF saved to:', fileUri);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save or share your PDF',
      });
    } else {
      console.warn('Sharing not available');
    }

    return fileUri;

  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};


function parseAiReport(response) {
  if (!response) return null;

  let jsonStr = response.trim();

  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(jsonStr.slice(braceStart, braceEnd + 1));
      } catch {}
    }
  }

  return null;
}

function buildPrompt(record, findings) {
  const fst = (ms) => { if (!ms && ms !== 0) return '--:--:--'; const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; };

  const tachyText = record.tachyDetails && record.tachyDetails.length > 0
    ? record.tachyDetails.map((e, i) =>
        `  Tachykardia #${i + 1}: od ${fst(e.start)} do ${fst(e.end)}, max BPM ${e.maxBpm}`).join('\n')
    : '  Brak epizodów tachykardii.';

  const bradyText = record.bradyDetails && record.bradyDetails.length > 0
    ? record.bradyDetails.map((e, i) =>
        `  Bradykardia #${i + 1}: od ${fst(e.start)} do ${fst(e.end)}, min BPM ${e.minBpm}`).join('\n')
    : '  Brak epizodów bradykardii.';

  const importantText = record.importantDetails && record.importantDetails.length > 0
    ? record.importantDetails.map((e, i) =>
        `  Ważne zdarzenie #${i + 1}: od ${fst(e.start)} do ${fst(e.end)}, BPM ${e.maxBpm || '--'}`).join('\n')
    : '  Brak ważnych zdarzeń.';

  return `Jesteś kardiologiem analizującym badanie Holter EKG. Na podstawie poniższych danych zwróć WYŁĄCZNIE obiekt JSON (bez żadnych innych słów, bez znaczników markdown).

{
  "summary": "Krótkie podsumowanie kliniczne (2-3 zdania) w języku polskim",
  "findings": [
    "Znalezisko kliniczne #1",
    "Znalezisko kliniczne #2",
    "Znalezisko kliniczne #3"
  ],
  "recommendation": "Zalecenie dla pacjenta (1-2 zdania) w języku polskim"
}

Dane badania:
- Średnie tętno: ${record.avgBpm} BPM
- Minimalne tętno: ${record.minBpm} BPM (czas: ${record.minBpmTime})
- Maksymalne tętno: ${record.maxBpm} BPM (czas: ${record.maxBpmTime})
- Czas trwania: ${record.duration}
- Całkowita liczba QRS: ${record.totalBeats || 0}
- Epizody tachykardii: ${record.tachyEpisodes || 0}
- Epizody bradykardii: ${record.bradyEpisodes || 0}
- Ważne zdarzenia pacjenta: ${record.importantDetails?.length || 0}

Szczegóły epizodów:
${tachyText}
${bradyText}
${importantText}

Wnioski z algorytmu:
${(findings || []).join('\n')}

Pamiętaj: odpowiedź ma być WYŁĄCZNIE obiektem JSON, bez żadnego dodatkowego tekstu.`;
}

export const generateReport = async (aiReport, activeReportRecord) => {
  if (!aiReport) {
    throw new Error("Brak danych do analizy");
  }

  const prompt = buildPrompt(activeReportRecord, aiReport.findings);
  const result = await sendPrompt(prompt);

  if (!result) {
    throw new Error("Brak odpowiedzi z modelu AI");
  }

  const parsed = parseAiReport(result);

  if (!parsed || !parsed.summary || !Array.isArray(parsed.findings)) {
    console.error("Nie udało się sparsować odpowiedzi AI:", result);
    throw new Error("Odpowiedź modelu AI ma nieprawidłowy format");
  }

  const reportText = JSON.stringify(parsed, null, 2);
  console.log("Sending text to PDF generator...");
  await getReport(reportText);

  return parsed;
};
