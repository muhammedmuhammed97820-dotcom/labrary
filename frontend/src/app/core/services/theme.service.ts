import { Injectable, signal } from '@angular/core';

export type LibraryTheme =
  | 'light'
  | 'dark'
  | 'purple'
  | 'ocean'
  | 'emerald'
  | 'sunset'
  | 'midnight'
  | 'neon';

export interface ThemeOption {
  id: LibraryTheme;
  name: string;
  icon: string;
  colors: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'library_theme';

  readonly themes: ThemeOption[] = [
    { id: 'light', name: 'نهاري زجاجي', icon: 'fa-solid fa-sun', colors: 'linear-gradient(135deg,#6366f1,#06b6d4)' },
    { id: 'dark', name: 'ليلي زجاجي', icon: 'fa-solid fa-moon', colors: 'linear-gradient(135deg,#818cf8,#22d3ee)' },
    { id: 'purple', name: 'Purple Dream', icon: 'fa-solid fa-wand-magic-sparkles', colors: 'linear-gradient(135deg,#7c3aed,#ec4899)' },
    { id: 'ocean', name: 'Ocean Glass', icon: 'fa-solid fa-water', colors: 'linear-gradient(135deg,#0284c7,#06b6d4)' },
    { id: 'emerald', name: 'Emerald Library', icon: 'fa-solid fa-leaf', colors: 'linear-gradient(135deg,#059669,#14b8a6)' },
    { id: 'sunset', name: 'Sunset', icon: 'fa-solid fa-sun-plant-wilt', colors: 'linear-gradient(135deg,#f97316,#ec4899)' },
    { id: 'midnight', name: 'Midnight Luxury', icon: 'fa-solid fa-gem', colors: 'linear-gradient(135deg,#111827,#8b5cf6)' },
    { id: 'neon', name: 'Cyber Neon', icon: 'fa-solid fa-bolt', colors: 'linear-gradient(135deg,#2563eb,#d946ef)' }
  ];

  readonly theme = signal<LibraryTheme>(this.readInitialTheme());
  readonly isDarkMode = signal<boolean>(this.isDark(this.theme()));

  constructor() {
    this.applyTheme(this.theme());
  }

  selectTheme(theme: LibraryTheme): void {
    this.theme.set(theme);
    this.isDarkMode.set(this.isDark(theme));
    this.persist(theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    this.selectTheme(this.isDark(this.theme()) ? 'light' : 'dark');
  }

  isSelected(theme: LibraryTheme): boolean {
    return this.theme() === theme;
  }

  private isDark(theme: LibraryTheme): boolean {
    return ['dark', 'midnight', 'neon'].includes(theme);
  }

  private applyTheme(theme: LibraryTheme): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const dark = this.isDark(theme);

    root.dataset['theme'] = theme;
    body.dataset['theme'] = theme;
    root.classList.toggle('dark-mode', dark);
    body.classList.toggle('dark-mode', dark);
    root.classList.toggle('light-mode', !dark);
    body.classList.toggle('light-mode', !dark);
  }

  private readInitialTheme(): LibraryTheme {
    try {
      const saved = localStorage.getItem(this.storageKey) as LibraryTheme | null;
      if (saved && this.themes.some(item => item.id === saved)) return saved;
    } catch {
      // Keep the premium dark theme when storage is unavailable.
    }
    return 'dark';
  }

  private persist(theme: LibraryTheme): void {
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
      // Theme still works for the current session.
    }
  }
}
