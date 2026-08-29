import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // استخدام Signals للتحكم بالحالة وتحديثها فوراً في كل التطبيق
  isDarkMode = signal<boolean>(true);

  toggleTheme(): void {
    this.isDarkMode.update(current => !current);
  }
}