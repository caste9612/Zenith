import {
  alphaVantageApiKey,
  firebaseConfig,
  finnhubApiKey,
  firebaseConfigured,
} from './firebase-config';

/**
 * Configurazione applicativa. I valori sensibili/di progetto Firebase arrivano da
 * `firebase-config.ts`, generato da `.env` (vedi scripts/generate-firebase-config.mjs).
 */
export const environment = {
  appName: 'Zenith',
  /** Valuta base dell'app (vedi CLAUDE.md). */
  baseCurrency: 'EUR' as const,
  /** Soglia di default oltre la quale, all'avvio, una quotazione in cache viene riaggiornata. */
  defaultQuoteStalenessMinutes: 720,
  firebase: firebaseConfig,
  /** true se Firebase è configurato (.env compilato). */
  firebaseConfigured,
  finnhubApiKey,
  alphaVantageApiKey,
} as const;
