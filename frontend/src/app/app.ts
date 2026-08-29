import { Component, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { NotificationToastComponent } from './shared/components/notification-toast/notification-toast';
import { ThemeService } from './core/services/theme.service';
import { CommonModule } from '@angular/common';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, NotificationToastComponent],
  templateUrl: './app.html',
})
export class App {
  public readonly themeService = inject(ThemeService);
  private document = inject(DOCUMENT);

  constructor() {
    // Keep the theme state synchronized on both html and body so the
    // page background, the area around the sticky navbar, and every
    // top-level element follow the same theme without white gaps.
    effect(() => {
      const isDark = this.themeService.isDarkMode();
      const html = this.document.documentElement;
      const body = this.document.body;

      if (isDark) {
        html.classList.add('dark-mode');
        html.classList.remove('light-mode');
        body.classList.add('dark-mode');
        body.classList.remove('light-mode');
      } else {
        html.classList.remove('dark-mode');
        html.classList.add('light-mode');
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
      }
    });
  }
}
