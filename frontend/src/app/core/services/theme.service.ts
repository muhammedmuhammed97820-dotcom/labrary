import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';
export type ThemePalette = 'rose' | 'ocean' | 'violet' | 'emerald' | 'sunset';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'library-theme';

  readonly mode = signal<ThemeMode>(this.readMode());
  readonly palette = signal<ThemePalette>(this.readPalette());

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

  reset(): void {
    this.mode.set('light');
    this.palette.set('rose');
    this.persist();
    this.apply();
  }

  private apply(): void {
    const root = this.document.documentElement;
    root.dataset['mode'] = this.mode();
    root.dataset['palette'] = this.palette();
    root.style.colorScheme = this.mode();
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify({
      mode: this.mode(),
      palette: this.palette()
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

  private readSaved(): Partial<{ mode: ThemeMode; palette: ThemePalette }> {
    if (typeof localStorage === 'undefined') return {};

    try {
      return JSON.parse(localStorage.getItem(this.storageKey) ?? '{}');
    } catch {
      return {};
    }
  }
}
