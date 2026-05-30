// Formattazione di numeri finanziari (valuta base EUR, locale it-IT).

const eur0 = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eur2 = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const signedEur0 = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

const pct = new Intl.NumberFormat('it-IT', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/** Importo in EUR. Default senza decimali (cifre da bilancio); `cents: true` per i centesimi. */
export function formatEur(value: number, opts?: { cents?: boolean }): string {
  return (opts?.cents ? eur2 : eur0).format(value);
}

/** Variazione in EUR con segno esplicito (+/−). */
export function formatSignedEur(value: number): string {
  return signedEur0.format(value);
}

/** Percentuale con segno; attende una frazione (0.12 → "+12,0%"). */
export function formatPercent(fraction: number): string {
  return pct.format(fraction);
}

/** Classe CSS per gain/loss/neutro, da applicare ai numeri. */
export function gainClass(value: number): 'gain' | 'loss' | 'flat' {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return 'flat';
}
