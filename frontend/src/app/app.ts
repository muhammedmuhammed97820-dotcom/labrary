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
    // مراقبة تغييرات الثيم وتطبيق الكلاس مباشرة على الـ body الخاص بالمتصفح
    effect(() => {
      const isDark = this.themeService.isDarkMode();
      if (isDark) {
        this.document.body.classList.add('dark-mode');
        this.document.body.classList.remove('light-mode');
      } else {
        this.document.body.classList.remove('dark-mode');
        this.document.body.classList.add('light-mode');
      }
    });
  }
}