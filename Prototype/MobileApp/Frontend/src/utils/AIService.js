import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_URL = 'http://:8000';

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

    // Read as base64 via arrayBuffer
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


export const generateReport = async (aiReport, activeReportRecord) => {
  if (!aiReport) {
    throw new Error("Brak danych do analizy");
  }

  const medicalContext = `
  Dane z EKG:
  - Średnie tętno: ${activeReportRecord.avgBpm} BPM
  - Maksymalne tętno: ${activeReportRecord.maxBpm} BPM (${activeReportRecord.maxBpmTime})
  - Minimalne tętno: ${activeReportRecord.minBpm} BPM (${activeReportRecord.minBpmTime})
  - Epizody tachykardii: ${activeReportRecord.tachyEpisodes}
  - Epizody bradykardii: ${activeReportRecord.bradyEpisodes}
  - Czas badania: ${activeReportRecord.duration}

  Wnioski z algorytmu:
  ${aiReport.findings.join('\n')}

  Wygeneruj podsumowanie kliniczne dla lekarza kardiologa.`;

  const result = await sendPrompt(medicalContext);

  if (result) {
    console.log("Sending text to PDF generator...");
    await getReport(result);
  }

  return result;
};
