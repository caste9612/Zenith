import { formatPercent, formatPercentPlain, formatSignedEur, gainClass } from './format';

describe('money/format', () => {
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
