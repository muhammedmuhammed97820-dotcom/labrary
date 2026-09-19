import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'electronic_library_theme';
  readonly isDarkMode = signal<boolean>(this.readInitialTheme());

  constructor() {
    this.applyTheme(this.isDarkMode());
  }

  toggleTheme(): void {
    this.setTheme(!this.isDarkMode());
  }

  setTheme(dark: boolean): void {
    this.isDarkMode.set(dark);
    this.applyTheme(dark);
    try { localStorage.setItem(this.storageKey, dark ? 'dark' : 'light'); } catch {}
  }

  private applyTheme(dark: boolean): void {
    const html = this.document.documentElement;
    const body = this.document.body;
    html.classList.toggle('dark-mode', dark);
    body?.classList.toggle('dark-mode', dark);
    html.style.colorScheme = dark ? 'dark' : 'light';
  }

  private readInitialTheme(): boolean {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved === 'light') return false;
      if (saved === 'dark') return true;
    } catch {}
    return true;
  }
}
