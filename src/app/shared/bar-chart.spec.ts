import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart';

describe('BarChartComponent', () => {
  let fixture: ComponentFixture<BarChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(BarChartComponent);
  });

  const labels = [new Date(2024, 0, 1), new Date(2024, 1, 1), new Date(2024, 2, 1)];

  it('una barra per valore presente (salta i null) e mostra la percentuale attiva', () => {
    fixture.componentRef.setInput('labels', labels);
    fixture.componentRef.setInput('values', [0.2, null, 0.3]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('svg rect.bar').length).toBe(2); // il null è saltato
    // default attivo = ultimo valore presente (0,3 → 30,0%)
    expect((fixture.nativeElement.querySelector('.val') as HTMLElement).textContent).toContain(
      '30,0',
    );
  });

  it('senza dati mostra il messaggio', () => {
    fixture.componentRef.setInput('labels', labels);
    fixture.componentRef.setInput('values', [null, null, null]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(fixture.nativeElement.textContent as string).toContain('Nessun dato');
  });
});
