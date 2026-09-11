import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface ColorPalette {
  dayC1: string; dayC2: string; dayC3: string;
  nightC1: string; nightC2: string; nightC3: string;
}

export type ThemePreset = {
  name: string;
  day: [string, string, string];
  night: [string, string, string];
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'electronic-library-theme';
  private readonly paletteKey = 'electronic-library-palette';

  readonly isDarkMode = signal<boolean>(false);

  readonly palette = signal<ColorPalette>({
    dayC1: '#ff9a9e', dayC2: '#fecfef', dayC3: '#a1c4fd',
    nightC1: '#0f0c29', nightC2: '#302b63', nightC3: '#24243e'
  });

  readonly presets: ThemePreset[] = [
    { name: 'وردي سماوي', day: ['#ff9a9e', '#fecfef', '#a1c4fd'], night: ['#0f0c29', '#302b63', '#24243e'] },
    { name: 'بنفسجي ملكي', day: ['#c471f5', '#fa71cd', '#fbc2eb'], night: ['#141e30', '#243b55', '#6a11cb'] },
    { name: 'محيط أزرق', day: ['#89f7fe', '#66a6ff', '#d4fc79'], night: ['#0f2027', '#203a43', '#2c5364'] },
    { name: 'غروب دافئ', day: ['#f6d365', '#fda085', '#fbc2eb'], night: ['#42275a', '#734b6d', '#c31432'] },
    { name: 'زمردي', day: ['#84fab0', '#8fd3f4', '#43e97b'], night: ['#0f3443', '#34e89e', '#0f9b8e'] },
    { name: 'نيون ليلي', day: ['#a18cd1', '#fbc2eb', '#84fab0'], night: ['#000428', '#004e92', '#7f00ff'] }
  ];

  constructor() {
    this.restore();

    effect(() => {
      const p = this.palette();
      const root = this.document.documentElement;
      const style = root.style;

      style.setProperty('--day-c1', p.dayC1);
      style.setProperty('--day-c2', p.dayC2);
      style.setProperty('--day-c3', p.dayC3);
      style.setProperty('--night-c1', p.nightC1);
      style.setProperty('--night-c2', p.nightC2);
      style.setProperty('--night-c3', p.nightC3);
      this.persistPalette(p);
    });

    effect(() => {
      const dark = this.isDarkMode();
      const root = this.document.documentElement;
      const body = this.document.body;

      // The CSS theme variables are scoped to these classes.
      // Keep both html and body synchronized so every page follows the switch.
      root.classList.toggle('theme-night', dark);
      root.classList.toggle('theme-day', !dark);
      body.classList.toggle('theme-night', dark);
      body.classList.toggle('theme-day', !dark);
      root.setAttribute('data-theme', dark ? 'night' : 'day');
      body.setAttribute('data-theme', dark ? 'night' : 'day');

      this.persistTheme(dark);
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update(value => !value);
  }

  updatePalette(colors: Partial<ColorPalette>): void {
    this.palette.update(current => ({ ...current, ...colors }));
  }

  applyPreset(preset: ThemePreset): void {
    this.palette.set({
      dayC1: preset.day[0], dayC2: preset.day[1], dayC3: preset.day[2],
      nightC1: preset.night[0], nightC2: preset.night[1], nightC3: preset.night[2]
    });
  }

  reset(): void {
    this.isDarkMode.set(false);
    this.applyPreset(this.presets[0]);
  }

  private restore(): void {
    try {
      const storedTheme = this.document.defaultView?.localStorage.getItem(this.storageKey);
      const storedPalette = this.document.defaultView?.localStorage.getItem(this.paletteKey);

      this.isDarkMode.set(storedTheme === 'night');

      if (storedPalette) {
        const parsed = JSON.parse(storedPalette) as Partial<ColorPalette>;
        this.palette.update(current => ({ ...current, ...parsed }));
      }
    } catch {
      // Ignore unavailable/corrupt browser storage and keep safe defaults.
    }
  }

  private persistTheme(isDark: boolean): void {
    try {
      this.document.defaultView?.localStorage.setItem(this.storageKey, isDark ? 'night' : 'day');
    } catch {}
  }

  private persistPalette(palette: ColorPalette): void {
    try {
      this.document.defaultView?.localStorage.setItem(this.paletteKey, JSON.stringify(palette));
    } catch {}
  }
}
