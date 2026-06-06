// Formattazione di numeri finanziari (valuta base EUR, locale it-IT).

// useGrouping: true → separatore delle migliaia sempre (it-IT di default usa "min2", che
// per 1.111/2.707 lo ometterebbe: numeri finanziari incoerenti). Vedi 04-design-guidelines.
const eur0 = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  useGrouping: true,
});

const eur2 = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const signedEur0 = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
  useGrouping: true,
});

const pct = new Intl.NumberFormat('it-IT', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

const pctPlain = new Intl.NumberFormat('it-IT', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Importo in EUR. Default senza decimali (cifre da bilancio); `cents: true` per i centesimi. */
export function formatEur(value: number, opts?: { cents?: boolean }): string {
  return (opts?.cents ? eur2 : eur0).format(value);
}

/** Importo EUR compatto per gli assi dei grafici (es. 95287 → "€95,3k"; 1.500.000 → "€1,5M"). */
export function formatCompactEur(value: number): string {
  const a = Math.abs(value);
  if (a >= 1_000_000) return `€${(Math.round(value / 100_000) / 10).toLocaleString('it-IT')}M`;
  if (a >= 1000) return `€${(Math.round(value / 100) / 10).toLocaleString('it-IT')}k`;
  return `€${Math.round(value)}`;
}

/** Variazione in EUR con segno esplicito (+/−). */
export function formatSignedEur(value: number): string {
  return signedEur0.format(value);
}

/** Percentuale con segno; attende una frazione (0.12 → "+12,0%"). */
export function formatPercent(fraction: number): string {
  return pct.format(fraction);
}

/** Percentuale senza segno forzato; attende una frazione (0.08 → "8,0%"). */
export function formatPercentPlain(fraction: number): string {
  return pctPlain.format(fraction);
}

/** Classe CSS per gain/loss/neutro, da applicare ai numeri. */
export function gainClass(value: number): 'gain' | 'loss' | 'flat' {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return 'flat';
}
