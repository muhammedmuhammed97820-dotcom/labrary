import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface ColorPalette {
  dayC1: string; dayC2: string; dayC3: string;
  nightC1: string; nightC2: string; nightC3: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);

  isDarkMode = signal<boolean>(false);
  
  // قيم الألوان الافتراضية
  palette = signal<ColorPalette>({
    dayC1: '#ff9a9e', dayC2: '#fecfef', dayC3: '#a1c4fd',
    nightC1: '#0f0c29', nightC2: '#302b63', nightC3: '#24243e'
  });

  constructor() {
    effect(() => {
      const p = this.palette();
      const root = this.document.documentElement.style;
      root.setProperty('--day-c1', p.dayC1);
      root.setProperty('--day-c2', p.dayC2);
      root.setProperty('--day-c3', p.dayC3);
      root.setProperty('--night-c1', p.nightC1);
      root.setProperty('--night-c2', p.nightC2);
      root.setProperty('--night-c3', p.nightC3);
    });
  }

  toggleTheme(): void { this.isDarkMode.update(v => !v); }
  
  updatePalette(colors: Partial<ColorPalette>): void {
    this.palette.update(current => ({ ...current, ...colors }));
  }
}