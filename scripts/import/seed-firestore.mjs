// Carica data/seed.json su Firestore, sotto users/{uid}/..., autenticandosi con email/password.
// Rispetta le security rules (scrive solo sotto il proprio uid). Esegui con: npm run import:seed
//
// Richiede in .env (gitignorato):
//   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID (+ gli altri)
//   SEED_EMAIL, SEED_PASSWORD  → le credenziali dell'utente creato in Firebase Authentication
//
// NB: la password resta solo in locale (.env non è committato). Puoi lanciarlo tu stesso.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getFirestore, Timestamp, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

const envPath = resolve(root, '.env');
if (!existsSync(envPath)) {
  console.error(
    '❌ .env non trovato. Copia .env.example in .env e compila i valori Firebase + SEED_EMAIL/SEED_PASSWORD.',
  );
  process.exit(1);
}
const env = parseEnv(readFileSync(envPath, 'utf8'));

const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
};
if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !env.SEED_EMAIL || !env.SEED_PASSWORD) {
  console.error('❌ Mancano FIREBASE_API_KEY/PROJECT_ID o SEED_EMAIL/SEED_PASSWORD in .env.');
  process.exit(1);
}

const seedPath = resolve(root, 'data/seed.json');
if (!existsSync(seedPath)) {
  console.error('❌ data/seed.json non trovato. Esegui prima: npm run import:parse');
  process.exit(1);
}
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

// Data di fine mese → Timestamp a mezzogiorno UTC (niente rotolamenti di fuso in UI).
function tsFromIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`→ Accesso come ${env.SEED_EMAIL}…`);
let cred;
try {
  cred = await signInWithEmailAndPassword(auth, env.SEED_EMAIL, env.SEED_PASSWORD);
} catch (e) {
  if (e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential') {
    console.log('  utente non trovato → lo creo…');
    cred = await createUserWithEmailAndPassword(auth, env.SEED_EMAIL, env.SEED_PASSWORD);
  } else {
    throw e;
  }
}
const uid = cred.user.uid;
console.log(`✓ uid: ${uid}`);
// Assicura che il token di auth sia pronto prima di scrivere (evita PERMISSION_DENIED
// per race tra auth e Firestore su un database appena creato).
await cred.user.getIdToken(true);

const userDoc = (...segments) => doc(db, 'users', uid, ...segments);

function buildBatch() {
  const batch = writeBatch(db);
  for (const a of seed.accounts) {
    const { id, ...rest } = a;
    batch.set(userDoc('accounts', id), rest);
  }
  for (const inst of seed.instruments) {
    const data = { ...inst };
    if (data.lastPriceAt) data.lastPriceAt = tsFromIso(data.lastPriceAt);
    batch.set(userDoc('instruments', inst.symbol), data);
  }
  for (const h of seed.holdings) {
    const ref = doc(collection(db, 'users', uid, 'holdings'));
    batch.set(ref, {
      accountId: h.accountId,
      instrumentId: h.instrumentSymbol,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currency: h.currency,
      priceMode: h.priceMode,
    });
  }
  for (const s of seed.snapshots) {
    const data = { date: tsFromIso(s.date), values: s.values, netWorth: s.netWorth };
    if (s.byOwner) data.byOwner = s.byOwner;
    if (s.savingRate !== undefined && s.savingRate !== null) data.savingRate = s.savingRate;
    batch.set(userDoc('snapshots', s.id), data);
  }
  batch.set(userDoc('settings', 'app'), {
    baseCurrency: 'EUR',
    quoteStalenessMinutes: 720,
    theme: 'system',
  });
  return batch;
}

const total =
  seed.accounts.length + seed.instruments.length + seed.holdings.length + seed.snapshots.length + 1;
console.log(`→ Scrittura di ${total} documenti…`);
let attempt = 0;
for (;;) {
  try {
    await buildBatch().commit();
    break;
  } catch (e) {
    if (e?.code === 'permission-denied' && attempt < 4) {
      attempt++;
      console.log(`  permesso negato: ritento (${attempt}/4) tra 4s (propagazione regole/token)…`);
      await new Promise((r) => setTimeout(r, 4000));
    } else {
      throw e;
    }
  }
}
console.log('✓ Import completato su Firestore.');
process.exit(0);
