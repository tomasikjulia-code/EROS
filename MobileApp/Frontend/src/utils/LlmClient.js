/**
 * Unified LLM Client
 *
 * Obsługuje 3 style API:
 *   openai  → POST /v1/chat/completions  (LM Studio, ChatGPT)
 *   ollama  → POST /api/generate          (Ollama native)
 *   gemini  → POST /v1beta/models/{model}:generateContent?key=...
 *
 * Publiczne API:
 *   call(prompt, config)  → Promise<string>   odpowiedź modelu
 *   ping(config)          → Promise<boolean>  czy serwer odpowiada
 */

const CALL_TIMEOUT_MS = 240_000; // 2 min (modele lokalne mogą być wolne)
const PING_TIMEOUT_MS = 5_000;

// ─── Timeout wrapper ─────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Adaptery ────────────────────────────────────────────────────────────────

async function callOpenAI(prompt, config) {
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const resp = await fetchWithTimeout(
    `${config.baseUrl}/v1/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    },
    CALL_TIMEOUT_MS
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const u = data.usage ?? {};
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: {
      promptTokens:     u.prompt_tokens     ?? 0,
      completionTokens: u.completion_tokens ?? 0,
      totalTokens:      u.total_tokens      ?? 0,
    },
  };
}

async function resolveOllamaModel(baseUrl, model) {
  if (model !== 'default') return model;
  try {
    const resp = await fetchWithTimeout(`${baseUrl}/api/tags`, { method: 'GET' }, PING_TIMEOUT_MS);
    if (!resp.ok) return model;
    const data = await resp.json();
    const first = data.models?.[0]?.name;
    return first ?? model;
  } catch {
    return model;
  }
}

async function callOllama(prompt, config) {
  const model = await resolveOllamaModel(config.baseUrl, config.model);
  const resp = await fetchWithTimeout(
    `${config.baseUrl}/api/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    },
    CALL_TIMEOUT_MS
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Ollama HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const p = data.prompt_eval_count ?? 0;
  const c = data.eval_count ?? 0;
  return {
    text: data.response ?? '',
    usage: { promptTokens: p, completionTokens: c, totalTokens: p + c },
  };
}

async function callGemini(prompt, config) {
  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const resp = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
    CALL_TIMEOUT_MS
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gemini HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const m = data.usageMetadata ?? {};
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    usage: {
      promptTokens:     m.promptTokenCount      ?? 0,
      completionTokens: m.candidatesTokenCount   ?? 0,
      totalTokens:      m.totalTokenCount        ?? 0,
    },
  };
}

// ─── Publiczne API ───────────────────────────────────────────────────────────

/**
 * Wyślij prompt do modelu.
 * @param {string} prompt
 * @param {{ apiStyle: string, baseUrl: string, apiKey?: string, model: string }} config
 * @returns {Promise<{ text: string, usage: { promptTokens, completionTokens, totalTokens } }>}
 */
export async function call(prompt, config) {
  if (!config?.baseUrl) throw new Error('Brak adresu serwera w konfiguracji LLM');
  if (!config?.model)   throw new Error('Brak nazwy modelu w konfiguracji LLM');

  switch (config.apiStyle) {
    case 'ollama': return callOllama(prompt, config);
    case 'gemini': return callGemini(prompt, config);
    default:       return callOpenAI(prompt, config);  // 'openai' + fallback
  }
}

/**
 * Sprawdź czy serwer odpowiada.
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function ping(config) {
  if (!config?.baseUrl) return { ok: false, detail: 'Brak adresu serwera.' };

  let url, options = {};

  if (config.apiStyle === 'ollama') {
    url = `${config.baseUrl}/api/tags`;
  } else if (config.apiStyle === 'gemini') {
    url = `${config.baseUrl}/v1beta/models?key=${config.apiKey ?? ''}`;
  } else {
    url = `${config.baseUrl}/v1/models`;
    if (config.apiKey) options.headers = { Authorization: `Bearer ${config.apiKey}` };
  }

  try {
    const resp = await fetchWithTimeout(url, { method: 'GET', ...options }, PING_TIMEOUT_MS);
    if (resp.ok) {
      return { ok: true, detail: `HTTP ${resp.status} — serwer odpowiada.` };
    }
    const body = await resp.text().catch(() => '');
    return { ok: false, detail: `HTTP ${resp.status}${body ? ': ' + body.slice(0, 120) : ''}` };
  } catch (err) {
    const msg = err?.message ?? String(err);
    const isCors = typeof msg === 'string' && (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS'));
    const corsHint = isCors
      ? '\nPrawdopodobna przyczyna: CORS — przeglądarka blokuje żądanie do lokalnego serwera. Włącz CORS w ustawieniach serwera lub testuj na urządzeniu.'
      : '';
    const isTimeout = err?.name === 'AbortError';
    return {
      ok: false,
      detail: isTimeout ? `Timeout (>${PING_TIMEOUT_MS / 1000}s) — serwer nie odpowiedział.` : `${msg}${corsHint}`,
    };
  }
}
