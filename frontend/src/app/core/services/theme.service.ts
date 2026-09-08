import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'library_theme';
  readonly isDarkMode = signal<boolean>(this.readInitialTheme());

  toggleTheme(): void {
    this.isDarkMode.update(current => {
      const next = !current;
      this.persist(next);
      return next;
    });
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
