import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';
export type ThemePalette = 'rose' | 'ocean' | 'violet' | 'emerald' | 'sunset';

export interface ThemeColors {
  day: string[];
  night: string[];
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'library-theme';

  readonly mode = signal<ThemeMode>(this.readMode());
  readonly palette = signal<ThemePalette>(this.readPalette());
  readonly dayColors = signal<string[]>(this.readColors('day'));
  readonly nightColors = signal<string[]>(this.readColors('night'));

  constructor() {
    this.apply();
  }

  toggleMode(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.persist();
    this.apply();
  }

  setPalette(palette: ThemePalette): void {
    this.palette.set(palette);
    this.persist();
    this.apply();
  }

  setColor(mode: 'day' | 'night', index: number, value: string): void {
    const colors = mode === 'day' ? [...this.dayColors()] : [...this.nightColors()];
    colors[index] = value;

    if (mode === 'day') {
      this.dayColors.set(colors);
    } else {
      this.nightColors.set(colors);
    }

    this.persist();
    this.apply();
  }

  setColors(colors: ThemeColors): void {
    this.dayColors.set([...colors.day]);
    this.nightColors.set([...colors.night]);
    this.persist();
    this.apply();
  }

  reset(): void {
    this.mode.set('light');
    this.palette.set('rose');
    this.dayColors.set(['#ff9a9e', '#fecfef', '#a1c4fd']);
    this.nightColors.set(['#0f0c29', '#302b63', '#24243e']);
    this.persist();
    this.apply();
  }

  private apply(): void {
    const root = this.document.documentElement;
    root.dataset['mode'] = this.mode();
    root.dataset['palette'] = this.palette();
    root.style.colorScheme = this.mode();

    this.dayColors().forEach((color, index) => {
      root.style.setProperty(`--day-c${index + 1}`, color);
    });

    this.nightColors().forEach((color, index) => {
      root.style.setProperty(`--night-c${index + 1}`, color);
    });
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;

    localStorage.setItem(this.storageKey, JSON.stringify({
      mode: this.mode(),
      palette: this.palette(),
      day: this.dayColors(),
      night: this.nightColors()
    }));
  }

  private readMode(): ThemeMode {
    const saved = this.readSaved().mode;
    return saved === 'dark' ? 'dark' : 'light';
  }

  private readPalette(): ThemePalette {
    const saved = this.readSaved().palette;
    const palettes: ThemePalette[] = ['rose', 'ocean', 'violet', 'emerald', 'sunset'];
    return palettes.includes(saved as ThemePalette) ? saved as ThemePalette : 'rose';
  }

  private readColors(mode: 'day' | 'night'): string[] {
    const saved = this.readSaved();
    const defaults = mode === 'day'
      ? ['#ff9a9e', '#fecfef', '#a1c4fd']
      : ['#0f0c29', '#302b63', '#24243e'];

    const colors = saved[mode];
    return Array.isArray(colors) && colors.length === 3 ? [...colors] : defaults;
  }

  private readSaved(): Partial<{
    mode: ThemeMode;
    palette: ThemePalette;
    day: string[];
    night: string[];
  }> {
    if (typeof localStorage === 'undefined') return {};

    try {
      return JSON.parse(localStorage.getItem(this.storageKey) ?? '{}');
    } catch {
      return {};
    }
  }
}
