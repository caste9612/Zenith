import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UpdaterService } from './updater';

describe('UpdaterService', () => {
  let service: UpdaterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), UpdaterService],
    });
    service = TestBed.inject(UpdaterService);
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'];
  });

  it('fuori da Tauri: checkOnStartup è un no-op e non segnala aggiornamenti', async () => {
    await service.checkOnStartup();
    expect(service.available()).toBeNull();
  });
});
