/**
 * Voce del registro accessi: scritta a ogni login con credenziali, così puoi rivedere
 * "chi/quando/da dove" è stato fatto l'accesso al tuo account e individuare attività insolite.
 *
 * App a utente singolo + vincolo Spark (niente Cloud Functions): è un rilevamento *che controlli
 * tu* in-app, non un alert via email lato server. È best-effort (un client malevolo potrebbe
 * non scriverlo), ma dà visibilità sugli accessi legittimi.
 */
export interface AccessLogEntry {
  id?: string;
  /** Istante dell'accesso. */
  at: Date;
  /** Piattaforma: `desktop` (app Tauri) | `web`. */
  platform: string;
  /** User agent grezzo del browser/OS, per riconoscere il dispositivo. */
  userAgent: string;
}
