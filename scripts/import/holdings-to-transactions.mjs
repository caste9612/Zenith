// Una-tantum: crea un movimento di "apertura" (buy) per ogni posizione importata, così le
// transazioni diventano la fonte di verità e il ricalcolo del PMC resta corretto.
// Idempotente: usa id documento deterministico `open-<instrumentId>`. Esegui: npm run import:openings
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, setDoc, Timestamp } from 'firebase/firestore';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!existsSync(resolve(root, '.env'))) {
  console.error('❌ .env non trovato.');
  process.exit(1);
}
const env = {};
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > -1) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const app = initializeApp({
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  appId: env.FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);
const cred = await signInWithEmailAndPassword(auth, env.SEED_EMAIL, env.SEED_PASSWORD);
await cred.user.getIdToken(true);
const uid = cred.user.uid;

// Data di apertura = riferimento dei dati importati (last.update dell'Excel).
const openingDate = Timestamp.fromDate(new Date(Date.UTC(2025, 4, 18, 12, 0, 0)));

const holdings = (await getDocs(collection(db, 'users', uid, 'holdings'))).docs.map((d) => ({
  id: d.id,
  ...d.data(),
}));
console.log(`posizioni trovate: ${holdings.length}`);

let n = 0;
for (const h of holdings) {
  const amount = Math.round(h.quantity * h.avgCost * 100) / 100;
  const txId = `open-${h.instrumentId}`;
  await setDoc(doc(db, 'users', uid, 'transactions', txId), {
    date: openingDate,
    type: 'buy',
    accountId: h.accountId ?? 'azionario',
    instrumentId: h.instrumentId,
    quantity: h.quantity,
    price: h.avgCost,
    amount,
    currency: h.currency ?? 'EUR',
    notes: 'Posizione iniziale (import)',
  });
  console.log(`  ${h.instrumentId.padEnd(10)} qty ${h.quantity}  costo € ${amount}`);
  n++;
}
console.log(`✓ create/aggiornate ${n} transazioni di apertura.`);
process.exit(0);
