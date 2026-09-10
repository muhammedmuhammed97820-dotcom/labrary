import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LibraryTheme, ThemeService } from '../../../core/services/theme.service';
import { NotificationService, Toast } from '../../../core/services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  public readonly themeService = inject(ThemeService);
  public readonly notificationService = inject(NotificationService);
  private readonly serverOrigin = 'http://localhost:5000';

  menuOpen = false;
  notificationsOpen = false;
  themePickerOpen = false;

  get isAdmin(): boolean { return this.auth.isAdmin; }
  get isLoggedIn(): boolean { return this.auth.isLoggedIn; }
  get userName(): string { return this.auth.currentUser?.name || 'المستخدم'; }

  get avatar(): string | null {
    const value = this.auth.currentUser?.avatar;
    if (!value) return null;
    if (/^data:|^blob:|^https?:\/\//i.test(value)) return value;
    return `${this.serverOrigin}${value.startsWith('/') ? value : `/${value}`}`;
  }

  get userInitial(): string { return this.userName.trim().charAt(0) || 'م'; }

  toggleTheme(): void { this.themeService.toggleTheme(); }

  toggleThemePicker(): void {
    this.themePickerOpen = !this.themePickerOpen;
    if (this.themePickerOpen) {
      this.notificationsOpen = false;
      this.menuOpen = false;
    }
  }

  selectTheme(theme: LibraryTheme): void {
    this.themeService.selectTheme(theme);
    this.themePickerOpen = false;
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) {
      this.menuOpen = false;
      this.themePickerOpen = false;
    }
  }

  dismissNotification(toast: Toast): void { this.notificationService.remove(toast.id); }

  clearNotifications(toasts: Toast[]): void {
    toasts.forEach(toast => this.notificationService.remove(toast.id));
  }

  logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  closeMenu(): void { this.menuOpen = false; }
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      this.notificationsOpen = false;
      this.themePickerOpen = false;
    }
  }
}
