export type ThemePreference = 'light' | 'dark' | 'system';

/** Preferenze applicative dell'utente (documento singolo per uid). */
export interface AppSettings {
  /** Valuta base; default 'EUR'. */
  baseCurrency: string;
  /** Soglia (minuti) oltre la quale, all'avvio, una quotazione in cache viene riaggiornata. */
  quoteStalenessMinutes: number;
  /** Tema preferito (sincronizzato; l'applicazione immediata usa anche localStorage). */
  theme: ThemePreference;
}

export const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'EUR',
  quoteStalenessMinutes: 720,
  theme: 'system',
};
