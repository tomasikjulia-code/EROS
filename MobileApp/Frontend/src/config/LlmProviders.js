/**
 * Predefiniowani dostawcy LLM.
 *
 * apiStyle: 'openai' | 'ollama' | 'gemini'
 *   - 'openai'  → POST /v1/chat/completions  (LM Studio, ChatGPT)
 *   - 'ollama'  → POST /api/generate          (Ollama native)
 *   - 'gemini'  → POST /v1beta/models/{model}:generateContent?key=... (Google)
 *
 * needsKey: true → UI pokazuje pole "Klucz API"
 */
export const PROVIDERS = [
  {
    id: 'lmstudio',
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234',
    apiStyle: 'openai',
    needsKey: false,
    // LM Studio ignoruje pole "model" w żądaniu — używa aktualnie załadowanego modelu.
    // Wpisz cokolwiek; "local-model" to bezpieczny placeholder.
    defaultModel: 'local-model',
    hint: 'Lokalny serwer LM Studio (domyślny port 1234). Na telefonie zastąp localhost adresem IP komputera w sieci Wi-Fi. Model może być dowolny — LM Studio używa aktualnie załadowanego.',
    suggestedModels: [
      'local-model',
      'llama-3.2-3b-instruct',
      'llama-3.1-8b-instruct',
      'gemma-3-12b-it',
      'mistral-7b-instruct',
      'phi-4-mini-instruct',
      'qwen2.5-7b-instruct',
      'deepseek-r1-distill-qwen-7b',
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434',
    apiStyle: 'ollama',
    needsKey: false,
    defaultModel: 'default',
    hint: 'Lokalny serwer Ollama (domyślny port 11434). Na telefonie zastąp localhost adresem IP komputera w Wi-Fi. Wpisz "default" aby użyć pierwszego dostępnego modelu, lub podaj nazwę z: ollama list',
    suggestedModels: [
      'default',
      'gemma3',
      'gemma3:12b',
      'llama3.2',
      'llama3.2:1b',
      'llama3.1:8b',
      'mistral',
      'qwen2.5:7b',
      'phi4-mini',
      'deepseek-r1:7b',
      'medllama2',
    ],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    baseUrl: 'https://api.openai.com',
    apiStyle: 'openai',
    needsKey: true,
    // gpt-4o-mini: najlepszy stosunek jakości do ceny, dostępny od razu po rejestracji
    defaultModel: 'gpt-4o-mini',
    hint: 'Wymaga klucza API z platform.openai.com. Nowe konta otrzymują kredyt startowy. gpt-4o-mini to najtańszy dobry model.',
    suggestedModels: [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiStyle: 'gemini',
    needsKey: true,
    // gemini-2.0-flash: dostępny na darmowym planie Google AI Studio (aistudio.google.com)
    defaultModel: 'gemini-2.0-flash',
    hint: 'Klucz API z aistudio.google.com (bezpłatny plan dostępny). gemini-2.0-flash i gemini-1.5-flash działają w ramach limitu darmowego.',
    suggestedModels: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
    ],
  },
  {
    id: 'custom',
    label: 'Własny',
    baseUrl: '',
    apiStyle: 'openai',
    needsKey: false,
    defaultModel: '',
    hint: 'Dowolny serwer kompatybilny z OpenAI API (np. LocalAI, vLLM, Jan).',
    suggestedModels: [],
  },
];

/** IDs dostawców wysyłających dane do zewnętrznych serwerów — wymagają monitu o prywatność */
export const PUBLIC_PROVIDER_IDS = ['chatgpt', 'gemini'];

/** Pomocnik: znajdź dostawcę po ID */
export const findProvider = (id) => PROVIDERS.find(p => p.id === id) ?? null;
