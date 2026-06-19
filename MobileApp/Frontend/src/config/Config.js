// ─── TRYB DEWELOPERSKI ──────────────────────────────────────────────────────
// Sterowane zmienną środowiskową EXPO_PUBLIC_MOCK_BT.
//
// Użycie przez skrypty npm (zalecane):
//   npm run start:mock          → Expo Go / QR kod, mock BT
//   npm run start:mock:web      → przeglądarka, mock BT
//   npm run android:mock        → APK na telefon USB, mock BT
//   npm start / npm run android → bez mocka, wymaga fizycznego holtera
//
// Fallback: jeśli zmienna nie jest ustawiona → false (tryb produkcyjny)
// ────────────────────────────────────────────────────────────────────────────

export const USE_MOCK_BT = process.env.EXPO_PUBLIC_MOCK_BT === 'true';
