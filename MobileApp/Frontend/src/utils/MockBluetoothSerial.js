/**
 * MockBluetoothSerial – identyczne API jak BluetoothSerial.js
 * Używany gdy USE_MOCK_BT = true w Config.js.
 *
 * Symulowany scenariusz CSV (~8h ±1h, 50 Hz):
 *  Faza 1  0–15%    : sen głęboki  ~54 BPM
 *  Faza 2  15–40%   : sen lekki    ~62 BPM
 *  Faza 3  40–52%   : pobudka/rano ~75 BPM
 *  Faza 4  52–68%   : aktywność    ~82 BPM  → epizod tachykardii
 *  Faza 5  68–90%   : popołudnie   ~71 BPM  → epizod bradykardii + ważne zdarzenie
 *  Faza 6  90–100%  : wieczór      ~65 BPM
 */

const MOCK_DEVICE = { name: 'RYTHMIO', address: 'MOCK:00:11:22:33:44' };

// ─── Generator próbki ECG ────────────────────────────────────────────────────

function ecgSample(cyclePos, cycleLen) {
  const t = cyclePos / cycleLen;
  let v = Math.random() * 200 - 100;
  if (t > 0.12 && t < 0.22) v += 800 * Math.sin((t - 0.12) * Math.PI / 0.10); // P
  if (t > 0.30 && t < 0.32) v -= 1500;                                           // Q
  if (t > 0.32 && t < 0.36) v += 8000;                                           // R (szczyt)
  if (t > 0.36 && t < 0.40) v -= 5000;                                           // S
  if (t > 0.48 && t < 0.65) v += 1500 * Math.sin((t - 0.48) * Math.PI / 0.17); // T
  return Math.round(v);
}

// ─── Generator pliku CSV ─────────────────────────────────────────────────────

function generateMockCsv() {
  const RATE     = 50;                                                     // Hz
  const RAND_MIN = Math.floor(Math.random() * 121) - 60;                  // ±60 min
  const DURATION = (2 * 60 + RAND_MIN) * 60;                              // s (7h–9h)
  const DT       = 1000 / RATE;                                            // ms/próbkę

  // Fazy: [od_s, do_s, target_bpm]
  const PHASES = [
    [0,                 DURATION * 0.15, 54],   // sen głęboki
    [DURATION * 0.15,   DURATION * 0.40, 62],   // sen lekki/REM
    [DURATION * 0.40,   DURATION * 0.52, 75],   // pobudka
    [DURATION * 0.52,   DURATION * 0.68, 82],   // aktywność
    [DURATION * 0.68,   DURATION * 0.90, 71],   // popołudnie
    [DURATION * 0.90,   DURATION,        65],    // wieczór
  ];

  // Losowe epizody
  const tachyStart  = DURATION * (0.52 + Math.random() * 0.10);  // w fazie aktywności
  const tachyEnd    = tachyStart  + 60 * (8 + Math.random() * 8);
  const bradyStart  = DURATION * (0.68 + Math.random() * 0.10);  // w popołudniu
  const bradyEnd    = bradyStart  + 60 * (5 + Math.random() * 6);
  const importantAt = DURATION * (0.70 + Math.random() * 0.10);

  const rows = ['Timestamp_ms,ECG_Raw,BPM,LeadOff,Activity,Important'];
  let cp     = 0;    // pozycja w cyklu QRS
  let bpmOU  = 65;   // Ornstein-Uhlenbeck state

  for (let i = 0; i < DURATION * RATE; i++) {
    const timeMs = Math.round(i * DT);
    const tSec   = timeMs / 1000;
    const frac   = tSec / DURATION;

    // Znajdź docelowy BPM z faz
    let targetBpm = 65;
    for (const [from, to, bpm] of PHASES) {
      if (tSec >= from && tSec < to) { targetBpm = bpm; break; }
    }

    // Epizody nadpisują cel
    if (tSec >= tachyStart && tSec < tachyEnd) targetBpm = 112 + Math.random() * 10;
    if (tSec >= bradyStart  && tSec < bradyEnd)  targetBpm =  42 + Math.random() * 6;

    // OU random walk — krok co próbkę (RATE próbek/s, więc α bardzo małe)
    const alpha    = 0.008 / RATE;
    const sigma    = 0.35;
    const noise    = (Math.random() + Math.random() - 1) * sigma;
    bpmOU         += alpha * (targetBpm - bpmOU) + noise;
    const bpm      = Math.max(36, Math.min(165, Math.round(bpmOU)));

    const cycleLen  = Math.round(RATE * 60 / Math.max(bpm, 30));
    const raw       = ecgSample(cp % cycleLen, cycleLen);
    cp++;

    // Aktywność: noc ~0, dzień ~3–6
    const actBase   = frac < 0.40 ? 0.5 : frac < 0.68 ? 5.0 : 2.5;
    const activity  = Math.max(0, Math.round((actBase + (Math.random() - 0.5) * actBase * 0.6) * 10) / 10);

    const important = (tSec >= importantAt && tSec < importantAt + 1) ? 1 : 0;

    rows.push(`${timeMs},${raw},${bpm},0,${activity},${important}`);
  }

  return rows.join('\n');
}

// ─── Singleton sesji mock BT ─────────────────────────────────────────────────

class MockBtSession {
  constructor() {
    this._cb          = null;
    this._ecgInterval = null;
    this._tick        = 0;
    this._csv         = null;
  }

  setCallback(cb) { this._cb = cb; }
  emit(line)      { this._cb?.(line); }

  handle(cmd) {
    const c = cmd.trim();
    if      (c === 'GET_STATE')      this._sendState();
    else if (c === 'GET_ECG')        this._startEcg();
    else if (c === 'STOP')           this._stopEcg();
    else if (c === 'GET_FILE')       this._sendReady();
    else if (c.startsWith('OK'))     this._sendFile();
    // REMOVE_FILE – ignorowany po cichu
  }

  // ── Diagnostyka ─────────────────────────────────────────────────────────
  _sendState() {
    // Mały delay, żeby receiveData zdążyło się zarejestrować przed odpowiedzią
    setTimeout(() => {
      this.emit('D' + JSON.stringify({
        battery:       87,
        signalQuality: 4,
        isMeasuring:   true,
        electrodes: [
          { name: 'RA', ok: true },
          { name: 'LA', ok: true },
          { name: 'RL', ok: true },
        ],
      }));
    }, 80);
  }

  // ── Live EKG ─────────────────────────────────────────────────────────────
  _liveEcgSample() {
    this._tick++;
    let v = Math.random() * 600 - 300;
    const c = this._tick % 250;
    if (c > 20 && c < 40) v += 1000 * Math.sin((c - 20) * Math.PI / 20);
    else if (c === 50) v -= 2000;
    else if (c === 53) v += 7800;
    else if (c === 56) v -= 6500;
    else if (c > 90 && c < 130) v += 2000 * Math.sin((c - 90) * Math.PI / 40);
    return Math.round(v);
  }

  _startEcg() {
    if (this._ecgInterval) return;
    this._ecgInterval = setInterval(() => this.emit('E' + this._liveEcgSample()), 4);
  }

  _stopEcg() {
    clearInterval(this._ecgInterval);
    this._ecgInterval = null;
  }

  // ── Transfer pliku ────────────────────────────────────────────────────────
  _sendReady() {
    this._csv = generateMockCsv();
    this.emit(`READY ${this._csv.length}`);
  }

  async _sendFile() {
    const lines  = (this._csv || '').split('\n');
    const CHUNK  = 1000;
    const CHUNKS = Math.ceil(lines.length / CHUNK);

    // Co ~15 chunków displayTask blokuje sdMutex na 500–2000 ms
    const DISPLAY_EVERY  = 15;
    const DISPLAY_MIN_MS = 500;
    const DISPLAY_MAX_MS = 2000;

    // Co ~60 chunków memory-pressure pause: 50–150 ms
    const MEM_EVERY  = 60;
    const MEM_MIN_MS = 50;
    const MEM_MAX_MS = 150;

    for (let ci = 0; ci < CHUNKS; ci++) {
      // Bazowy delay między chunkami (symuluje 5–20 ms SD read + BT write)
      await new Promise(r => setTimeout(r, 8 + Math.random() * 10));

      // Pauza sdMutex od displayTask
      if (ci > 0 && ci % DISPLAY_EVERY === 0) {
        const pause = DISPLAY_MIN_MS + Math.random() * (DISPLAY_MAX_MS - DISPLAY_MIN_MS);
        await new Promise(r => setTimeout(r, pause));
      }

      // Pauza memory-pressure
      if (ci > 0 && ci % MEM_EVERY === 0) {
        const pause = MEM_MIN_MS + Math.random() * (MEM_MAX_MS - MEM_MIN_MS);
        await new Promise(r => setTimeout(r, pause));
      }

      const start = ci * CHUNK;
      lines.slice(start, start + CHUNK).forEach(l => l.trim() && this.emit(l));
    }

    this.emit('S');
  }

  destroy() {
    this._stopEcg();
    this._cb  = null;
    this._csv = null;
  }
}

const _session = new MockBtSession();

// ─── Publiczne API (identyczne z BluetoothSerial.js) ─────────────────────────

export async function requestBluetoothPermissions() { return true; }
export async function getPairedDevices()            { return [MOCK_DEVICE]; }
export async function connectToDevice()             { return MOCK_DEVICE; }
export async function disconnectDevice()            { _session.destroy(); }
export async function sendData(_addr, message)      { _session.handle(message); }

export function receiveData(_addr, onData) {
  _session.setCallback(onData);
  return { remove: () => _session.setCallback(null) };
}
