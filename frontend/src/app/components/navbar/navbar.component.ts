import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

interface LibraryNotification {
  id: number;
  title: string;
  text: string;
  time: string;
  unread: boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  readonly themeService = inject(ThemeService);
  menuOpen = signal(false);
  customizerOpen = signal(false);
  notificationsOpen = signal(false);
  isNight = signal(this.themeService.mode() === 'dark');

  day = ['#ff9a9e', '#fecfef', '#a1c4fd'];
  night = ['#0f0c29', '#302b63', '#24243e'];

  notifications: LibraryNotification[] = [];

  get unreadCount(): number {
    return this.notifications.filter(notification => notification.unread).length;
  }

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
    this.customizerOpen.set(false);
    this.notificationsOpen.set(false);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleMode();
    this.isNight.set(this.themeService.mode() === 'dark');
  }

  toggleCustomizer(): void {
    this.customizerOpen.update(open => !open);
    this.notificationsOpen.set(false);
    this.closeMenu();
  }

  toggleNotifications(): void {
    this.notificationsOpen.update(open => !open);
    this.customizerOpen.set(false);
    this.closeMenu();
  }

  markAllRead(): void {
    this.notifications = this.notifications.map(notification => ({
      ...notification,
      unread: false
    }));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const clickedInsideDropdown = target.closest(
      '.customizer-panel, .notifications-panel, .palette-btn, .notification-wrap, .menu-toggle'
    );

    if (!clickedInsideDropdown) {
      this.menuOpen.set(false);
      this.customizerOpen.set(false);
      this.notificationsOpen.set(false);
    }
  }

  setColor(mode: 'day' | 'night', index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const colors = mode === 'day' ? this.day : this.night;
    colors[index] = value;
    document.documentElement.style.setProperty(`--${mode}-c${index + 1}`, value);
  }

  applyPreset(preset: { day: string[]; night: string[] }): void {
    this.day = [...preset.day];
    this.night = [...preset.night];
    this.applyColors();
  }

  applyColors(): void {
    this.day.forEach((c, i) => document.documentElement.style.setProperty(`--day-c${i + 1}`, c));
    this.night.forEach((c, i) => document.documentElement.style.setProperty(`--night-c${i + 1}`, c));
  }

  presets = [
    { day: ['#ff9a9e', '#fecfef', '#a1c4fd'], night: ['#0f0c29', '#302b63', '#24243e'] },
    { day: ['#84fab0', '#a1c4fd', '#8fd3f4'], night: ['#09203f', '#537895', '#1e3c72'] },
    { day: ['#fccb90', '#fecfef', '#d57eeb'], night: ['#2b1055', '#7597de', '#240b36'] }
  ];
}
