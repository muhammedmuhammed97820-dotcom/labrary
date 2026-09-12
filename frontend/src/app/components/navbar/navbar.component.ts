import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService, LibraryNotification } from '../../core/services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  readonly themeService = inject(ThemeService);
  readonly notificationService = inject(NotificationService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  menuOpen = signal(false);
  customizerOpen = signal(false);
  notificationsOpen = signal(false);
  isNight = signal(this.themeService.mode() === 'dark');
  day = [...this.themeService.dayColors()];
  night = [...this.themeService.nightColors()];
  presets = [
    { day: ['#ff9a9e', '#fecfef', '#a1c4fd'], night: ['#0f0c29', '#302b63', '#24243e'] },
    { day: ['#84fab0', '#a1c4fd', '#8fd3f4'], night: ['#09203f', '#537895', '#1e3c72'] },
    { day: ['#fccb90', '#fecfef', '#d57eeb'], night: ['#2b1055', '#7597de', '#240b36'] }
  ];

  constructor() { this.notificationService.loadLibraryNotifications(); }

  get notifications(): Array<LibraryNotification & { time: string }> {
    return this.notificationService.libraryNotifications().map(item => ({ ...item, time: this.relativeTime(item.createdAt) }));
  }
  get unreadCount(): number { return this.notificationService.unreadCount(); }
  get isLoggedIn(): boolean { return this.auth.isLoggedIn; }
  get isAdmin(): boolean { return this.auth.isAdmin; }
  get displayName(): string { return this.auth.currentUser?.name || 'حسابي'; }

  toggleMenu(): void { this.menuOpen.update(open => !open); this.customizerOpen.set(false); this.notificationsOpen.set(false); }
  closeMenu(): void { this.menuOpen.set(false); }
  toggleTheme(): void { this.themeService.toggleMode(); this.isNight.set(this.themeService.mode() === 'dark'); }
  toggleCustomizer(): void { this.customizerOpen.update(open => !open); this.notificationsOpen.set(false); this.closeMenu(); }
  toggleNotifications(): void {
    this.notificationsOpen.update(open => !open);
    this.customizerOpen.set(false);
    this.closeMenu();
    if (this.notificationsOpen()) this.notificationService.loadLibraryNotifications();
  }
  markAllRead(): void { this.notificationService.markAllLibraryRead(); }

  openNotification(notification: LibraryNotification): void {
    if (notification.unread) this.notificationService.markAllLibraryRead();
    this.notificationsOpen.set(false);
    if (notification.link) this.router.navigateByUrl(notification.link);
  }

  goToAccount(): void {
    this.closeMenu();
    this.router.navigateByUrl(this.isAdmin ? '/admin' : '/profile');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const clickedInsideDropdown = target.closest('.customizer-panel, .notifications-panel, .palette-btn, .notification-wrap, .menu-toggle');
    if (!clickedInsideDropdown) { this.menuOpen.set(false); this.customizerOpen.set(false); this.notificationsOpen.set(false); }
  }

  setColor(mode: 'day' | 'night', index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const colors = mode === 'day' ? this.day : this.night;
    colors[index] = value;
    this.themeService.setColor(mode, index, value);
  }

  applyPreset(preset: { day: string[]; night: string[] }): void {
    this.day = [...preset.day];
    this.night = [...preset.night];
    this.themeService.setColors({ day: this.day, night: this.night });
  }
  applyColors(): void { this.themeService.setColors({ day: this.day, night: this.night }); }

  private relativeTime(value?: string): string {
    if (!value) return 'الآن';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return 'الآن';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `قبل ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return days < 30 ? `قبل ${days} يوم` : new Date(value).toLocaleDateString('ar-IQ');
  }
}
