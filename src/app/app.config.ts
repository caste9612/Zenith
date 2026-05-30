import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Zoneless: niente zone.js. La change detection scatta solo sui cambi di Signal/eventi
    // → meno cicli di CD, UI più fluida (cruciale su WebView mobile) e bundle più leggero.
    provideZonelessChangeDetection(),
    // Precarica i (piccoli) chunk delle altre rotte dopo il primo render → navigazione istantanea.
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
};
