// Genera src/environments/firebase-config.ts a partire da .env (gitignorato).
// La config web di Firebase non è un segreto, ma la teniamo fuori dal repo per pulizia
// (vedi CLAUDE.md). Questo script gira automaticamente prima di build/serve/tauri.
// Se .env manca o è incompleto, scrive dei placeholder e segna firebaseConfigured=false,
// così l'app compila e mostra un avviso di configurazione invece di andare in crash.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env');
const outPath = resolve(root, 'src/environments/firebase-config.ts');

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let env = {};
if (existsSync(envPath)) {
  env = parseEnv(readFileSync(envPath, 'utf8'));
} else {
  console.warn(
    '[config:gen] .env non trovato — genero placeholder. Copia .env.example in .env e compila i valori.',
  );
}

const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY ?? '',
  authDomain: env.FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.FIREBASE_APP_ID ?? '',
};

const finnhubApiKey = env.FINNHUB_API_KEY ?? '';
const alphaVantageApiKey = env.ALPHAVANTAGE_API_KEY ?? '';
const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

const banner = `// FILE GENERATO AUTOMATICAMENTE da scripts/generate-firebase-config.mjs.
// NON modificare a mano e NON committare: è ricreato a ogni build da .env.
`;

const body = `${banner}
export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)} as const;

export const finnhubApiKey = ${JSON.stringify(finnhubApiKey)};

export const alphaVantageApiKey = ${JSON.stringify(alphaVantageApiKey)};

/** true solo se i campi Firebase essenziali (apiKey, projectId, appId) sono presenti in .env. */
export const firebaseConfigured = ${firebaseConfigured};
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body, 'utf8');
console.log(`[config:gen] Scritto ${outPath} (firebaseConfigured=${firebaseConfigured})`);
