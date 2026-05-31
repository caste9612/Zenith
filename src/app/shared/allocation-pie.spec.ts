import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AllocationPieComponent } from './allocation-pie';

describe('AllocationPieComponent', () => {
  let fixture: ComponentFixture<AllocationPieComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(AllocationPieComponent);
  });

  const legend = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.legend li')).map((li) =>
      (li as HTMLElement).textContent!.replace(/\s+/g, ' ').trim(),
    );
  const paths = (): number => fixture.nativeElement.querySelectorAll('svg path').length;

  it('calcola le percentuali e una fetta per ogni voce con valore > 0', () => {
    fixture.componentRef.setInput('items', [
      { label: 'A', value: 75 },
      { label: 'B', value: 25 },
    ]);
    fixture.detectChanges();
    const items = legend();
    expect(items.length).toBe(2);
    expect(items[0]).toContain('A');
    expect(items[0]).toContain('75%');
    expect(items[1]).toContain('25%');
    expect(paths()).toBe(2);
  });

  it('esclude le voci con valore ≤ 0', () => {
    fixture.componentRef.setInput('items', [
      { label: 'A', value: 100 },
      { label: 'Z', value: 0 },
    ]);
    fixture.detectChanges();
    expect(legend().length).toBe(1);
    expect(legend()[0]).toContain('100%');
    expect(paths()).toBe(1);
  });

  it('senza dati mostra il messaggio vuoto', () => {
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.legend')).toBeNull();
    expect(fixture.nativeElement.textContent as string).toContain('Nessun dato');
  });
});
