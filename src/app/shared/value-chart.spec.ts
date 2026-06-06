import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartPoint, ValueChartComponent } from './value-chart';

describe('ValueChartComponent', () => {
  let fixture: ComponentFixture<ValueChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(ValueChartComponent);
  });

  const points = (...values: number[]): ChartPoint[] =>
    values.map((value, i) => ({ date: new Date(2024, i, 1), value }));

  it('con ≥ 2 punti disegna area + linea e mostra l’ultimo valore', () => {
    fixture.componentRef.setInput('points', points(100, 200, 300));
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg.svg') as SVGElement | null;
    expect(svg).not.toBeNull();
    // due path: l'area e la linea
    expect(fixture.nativeElement.querySelectorAll('svg path').length).toBe(2);
    const line = fixture.nativeElement.querySelector('path.line') as SVGPathElement;
    expect(line.getAttribute('d')!.startsWith('M')).toBe(true);
    // il readout mostra di default il valore dell'ultimo punto
    expect(
      (fixture.nativeElement.querySelector('.readout .val') as HTMLElement).textContent,
    ).toContain('300');
  });

  it('con meno di 2 punti mostra il messaggio "dati insufficienti"', () => {
    fixture.componentRef.setInput('points', points(100));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(fixture.nativeElement.textContent as string).toContain('Dati insufficienti');
  });
});
