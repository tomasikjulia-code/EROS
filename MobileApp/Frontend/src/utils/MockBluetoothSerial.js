/**
 * MockBluetoothSerial – identyczne API jak BluetoothSerial.js
 * Używany gdy USE_MOCK_BT = true w Config.js.
 *
 * Symulowany scenariusz CSV (5 minut, 50 Hz):
 *   0–60 s   : rytm zatokowy 72 BPM  (ignorowane w analizie – IGNORE_FIRST_MS)
 *  60–120 s  : rytm zatokowy 72 BPM
 * 120–180 s  : tachykardia   115 BPM  → wykryty epizod
 * 180–210 s  : powrót         85 BPM
 * 210–250 s  : bradykardia    42 BPM  → wykryty epizod
 * 250–270 s  : powrót         62 BPM
 * 270–271 s  : ważne zdarzenie (Important = 1)
 * 271–300 s  : rytm zatokowy 68 BPM
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
  const RATE = 50;           // Hz
  const DURATION = 5 * 60;  // s
  const DT = 1000 / RATE;   // ms / próbkę

  const rows = ['Timestamp_ms,ECG_Raw,BPM,LeadOff,Activity,Important'];
  let cp = 0; // pozycja w cyklu QRS

  for (let i = 0; i < DURATION * RATE; i++) {
    const timeMs = Math.round(i * DT);
    const tSec   = timeMs / 1000;

    let bpm = 72;
    if      (tSec >= 120 && tSec < 180) bpm = 115;
    else if (tSec >= 180 && tSec < 210) bpm = 85;
    else if (tSec >= 210 && tSec < 250) bpm = 42;
    else if (tSec >= 250 && tSec < 270) bpm = 62;
    else if (tSec >= 270)               bpm = 68;

    const cycleLen = Math.round(RATE * 60 / bpm);
    const raw      = ecgSample(cp % cycleLen, cycleLen);
    cp++;

    const activity  = Math.round(Math.random() * 3 * 10) / 10;
    const important = (tSec >= 270 && tSec < 271) ? 1 : 0;

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
    const lines = (this._csv || '').split('\n');
    const CHUNK = 30; // linii na "pakiet"
    for (let i = 0; i < lines.length; i += CHUNK) {
      await new Promise(r => setTimeout(r, 15));
      lines.slice(i, i + CHUNK).forEach(l => l.trim() && this.emit(l));
    }
    this.emit('S'); // koniec transferu
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
