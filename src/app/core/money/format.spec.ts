import { formatEur, formatPercent, formatPercentPlain, formatSignedEur, gainClass } from './format';

describe('money/format', () => {
  it('formatEur: interi con separatore delle migliaia (it-IT), simbolo €', () => {
    expect(formatEur(1111)).toContain('1.111'); // il bug "min2" ometteva il punto
    expect(formatEur(2707)).toContain('2.707');
    expect(formatEur(1234567)).toContain('1.234.567');
    expect(formatEur(1000)).toContain('€');
  });

  it('formatEur: senza decimali arrotonda; zero e negativi', () => {
    expect(formatEur(1234.99)).toContain('1.235'); // maximumFractionDigits 0 → arrotonda
    expect(formatEur(0)).toContain('0');
    const neg = formatEur(-1000);
    expect(neg).toContain('1.000');
    expect(neg).not.toContain('+'); // niente segno + (formatEur non forza il segno)
  });

  it('formatEur: con cents mostra due decimali e separatore', () => {
    expect(formatEur(1234.5, { cents: true })).toContain('1.234,50');
    expect(formatEur(7.1, { cents: true })).toContain('7,10');
  });

  it('formatSignedEur: segno esplicito tranne lo zero', () => {
    expect(formatSignedEur(1000)).toContain('+');
    expect(formatSignedEur(1000)).toContain('1.000');
    const neg = formatSignedEur(-1000);
    expect(neg).not.toContain('+'); // niente segno +, c'è il meno (glifo dipende dall'ICU)
    expect(neg).toContain('1.000');
    expect(formatSignedEur(0)).not.toContain('+');
  });

  it('formatPercent: percentuale con segno, una cifra decimale', () => {
    expect(formatPercent(0.08)).toContain('8,0');
    expect(formatPercent(0.08)).toContain('+');
    expect(formatPercent(0.08)).toContain('%');
    expect(formatPercent(-0.123)).toContain('12,3');
  });

  it('formatPercentPlain: percentuale senza segno forzato', () => {
    expect(formatPercentPlain(0.08)).toContain('8,0');
    expect(formatPercentPlain(0.08)).not.toContain('+');
    expect(formatPercentPlain(0.08)).toContain('%');
  });

  it('gainClass: gain / loss / flat con confine a zero', () => {
    expect(gainClass(1)).toBe('gain');
    expect(gainClass(-1)).toBe('loss');
    expect(gainClass(0)).toBe('flat');
  });
});
