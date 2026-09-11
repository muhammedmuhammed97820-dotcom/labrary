import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export interface ColorPalette {
  dayC1: string;
  dayC2: string;
  dayC3: string;
  nightC1: string;
  nightC2: string;
  nightC3: string;
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

  readonly isDarkMode = signal(false);

  readonly palette = signal<ColorPalette>({
    dayC1: '#ff9a9e',
    dayC2: '#fecfef',
    dayC3: '#a1c4fd',
    nightC1: '#0f0c29',
    nightC2: '#302b63',
    nightC3: '#24243e'
  });

  readonly presets: ThemePreset[] = [
    {
      name: 'وردي سماوي',
      day: ['#ff9a9e', '#fecfef', '#a1c4fd'],
      night: ['#0f0c29', '#302b63', '#24243e']
    },
    {
      name: 'بنفسجي ملكي',
      day: ['#c471f5', '#fa71cd', '#fbc2eb'],
      night: ['#141e30', '#243b55', '#6a11cb']
    },
    {
      name: 'محيط أزرق',
      day: ['#89f7fe', '#66a6ff', '#d4fc79'],
      night: ['#0f2027', '#203a43', '#2c5364']
    },
    {
      name: 'غروب دافئ',
      day: ['#f6d365', '#fda085', '#fbc2eb'],
      night: ['#42275a', '#734b6d', '#c31432']
    },
    {
      name: 'زمردي',
      day: ['#84fab0', '#8fd3f4', '#43e97b'],
      night: ['#0f3443', '#34e89e', '#0f9b8e']
    },
    {
      name: 'نيون ليلي',
      day: ['#a18cd1', '#fbc2eb', '#84fab0'],
      night: ['#000428', '#004e92', '#7f00ff']
    }
  ];

  constructor() {
    this.restore();

    effect(() => {
      const palette = this.palette();
      const root = this.document.documentElement;

      root.style.setProperty('--day-c1', palette.dayC1);
      root.style.setProperty('--day-c2', palette.dayC2);
      root.style.setProperty('--day-c3', palette.dayC3);
      root.style.setProperty('--night-c1', palette.nightC1);
      root.style.setProperty('--night-c2', palette.nightC2);
      root.style.setProperty('--night-c3', palette.nightC3);

      root.style.setProperty('--library-gradient-day', `linear-gradient(135deg, ${palette.dayC1}, ${palette.dayC2}, ${palette.dayC3})`);
      root.style.setProperty('--library-gradient-night', `linear-gradient(135deg, ${palette.nightC1}, ${palette.nightC2}, ${palette.nightC3})`);

      this.persistPalette(palette);
    });

    effect(() => {
      const dark = this.isDarkMode();
      const root = this.document.documentElement;
      const body = this.document.body;

      root.classList.toggle('theme-night', dark);
      root.classList.toggle('theme-day', !dark);
      body.classList.toggle('theme-night', dark);
      body.classList.toggle('theme-day', !dark);
      root.dataset['theme'] = dark ? 'night' : 'day';
      body.dataset['theme'] = dark ? 'night' : 'day';

      this.persistTheme(dark);
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update(value => !value);
  }

  setTheme(mode: 'day' | 'night'): void {
    this.isDarkMode.set(mode === 'night');
  }

  updatePalette(colors: Partial<ColorPalette>): void {
    this.palette.update(current => ({ ...current, ...colors }));
  }

  applyPreset(preset: ThemePreset): void {
    this.palette.set({
      dayC1: preset.day[0],
      dayC2: preset.day[1],
      dayC3: preset.day[2],
      nightC1: preset.night[0],
      nightC2: preset.night[1],
      nightC3: preset.night[2]
    });
  }

  reset(): void {
    this.setTheme('day');
    this.applyPreset(this.presets[0]);
  }

  private restore(): void {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) return;

      this.isDarkMode.set(storage.getItem(this.storageKey) === 'night');

      const storedPalette = storage.getItem(this.paletteKey);
      if (!storedPalette) return;

      const parsed = JSON.parse(storedPalette) as Partial<ColorPalette>;
      this.palette.update(current => ({ ...current, ...parsed }));
    } catch {
      // Keep the built-in theme when browser storage is unavailable or invalid.
    }
  }

  private persistTheme(isDark: boolean): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        this.storageKey,
        isDark ? 'night' : 'day'
      );
    } catch {}
  }

  private persistPalette(palette: ColorPalette): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        this.paletteKey,
        JSON.stringify(palette)
      );
    } catch {}
  }
}
