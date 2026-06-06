import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StackedAreaChartComponent, StackSeries } from './stacked-area-chart';

describe('StackedAreaChartComponent', () => {
  let fixture: ComponentFixture<StackedAreaChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(StackedAreaChartComponent);
  });

  const labels = [new Date(2024, 0, 1), new Date(2024, 1, 1), new Date(2024, 2, 1)];
  const series: StackSeries[] = [
    { name: 'A', color: '#111', values: [10, 20, 30] },
    { name: 'B', color: '#222', values: [5, 5, 10] },
  ];

  it('disegna un’area per serie e una legenda con i valori dell’ultimo mese', () => {
    fixture.componentRef.setInput('labels', labels);
    fixture.componentRef.setInput('series', series);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('svg path.area').length).toBe(2);
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.legend li')).map((li) =>
      (li as HTMLElement).textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('A');
    // default: ultimo mese → A=30, B=10, totale 40
    expect((fixture.nativeElement.querySelector('.total') as HTMLElement).textContent).toContain(
      '40',
    );
  });

  it('con meno di 2 mesi mostra il messaggio "dati insufficienti"', () => {
    fixture.componentRef.setInput('labels', [labels[0]]);
    fixture.componentRef.setInput('series', series);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(fixture.nativeElement.textContent as string).toContain('Dati insufficienti');
  });
});
