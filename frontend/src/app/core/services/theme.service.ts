import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'library_theme';
  readonly isDarkMode = signal<boolean>(this.readInitialTheme());

  constructor() {
    this.applyTheme(this.isDarkMode());
  }

  toggleTheme(): void {
    this.isDarkMode.update(current => {
      const next = !current;
      this.persist(next);
      this.applyTheme(next);
      return next;
    });
  }

  private applyTheme(isDark: boolean): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle('light-mode', !isDark);
    body.classList.toggle('light-mode', !isDark);
    root.classList.toggle('dark-mode', isDark);
    body.classList.toggle('dark-mode', isDark);
  }

  private readInitialTheme(): boolean {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved === 'light') return false;
      if (saved === 'dark') return true;
    } catch {
      // Ignore storage restrictions and keep the premium dark default.
    }
    return true;
  }

  private persist(isDark: boolean): void {
    try {
      localStorage.setItem(this.storageKey, isDark ? 'dark' : 'light');
    } catch {
      // Theme still works for the current session when storage is unavailable.
    }
  }
}
