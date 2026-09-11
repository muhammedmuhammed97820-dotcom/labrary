import { Component, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { NotificationToastComponent } from './shared/components/notification-toast/notification-toast';
import { ThemeService } from './core/services/theme.service';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, NotificationToastComponent],
  templateUrl: './app.html'
})
export class App {
  public readonly themeService = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      const isDark = this.themeService.isDarkMode();
      const html = this.document.documentElement;
      const body = this.document.body;
      const themeClass = isDark ? 'theme-night' : 'theme-day';
      const oldThemeClass = isDark ? 'theme-day' : 'theme-night';

      html.classList.remove(oldThemeClass, 'light-mode', 'dark-mode');
      body.classList.remove(oldThemeClass, 'light-mode', 'dark-mode');
      html.classList.add(themeClass);
      body.classList.add(themeClass);

      if (isDark) {
        html.classList.add('dark-mode');
        body.classList.add('dark-mode');
      } else {
        html.classList.add('light-mode');
        body.classList.add('light-mode');
      }
    });
  }
}
