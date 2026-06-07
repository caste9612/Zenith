import { describeDevice } from './access-log';

describe('describeDevice', () => {
  it('app desktop con Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36';
    expect(describeDevice('desktop', ua)).toBe('App desktop · Chrome · Windows');
  });

  it('web su Chrome/Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36';
    expect(describeDevice('web', ua)).toBe('Web · Chrome · Windows');
  });

  it('Edge ha priorità su Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0';
    expect(describeDevice('web', ua)).toBe('Web · Edge · Windows');
  });

  it('Firefox su Android', () => {
    expect(describeDevice('web', 'Mozilla/5.0 (Android 14; Mobile) Firefox/121.0')).toBe(
      'Web · Firefox · Android',
    );
  });

  it('Safari su iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1';
    expect(describeDevice('web', ua)).toBe('Web · Safari · iOS');
  });

  it('user agent vuoto → solo la piattaforma', () => {
    expect(describeDevice('web', '')).toBe('Web');
    expect(describeDevice('desktop', '')).toBe('App desktop');
  });
});
