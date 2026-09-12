import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

export interface LibraryNotification {
  id: string;
  type: string;
  title: string;
  text: string;
  link: string;
  unread: boolean;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/notifications`;
  public readonly notifications = signal<ToastNotification[]>([]);
  public readonly libraryNotifications = signal<LibraryNotification[]>([]);
  public readonly unreadCount = signal(0);

  public show(message: string, type: NotificationType = 'info', duration = 3000): void {
    const id = Math.random().toString(36).substring(2, 9);
    this.notifications.update(current => [...current, { id, message, type, duration }]);
    if (duration > 0) setTimeout(() => this.remove(id), duration);
  }

  public success(message: string, duration?: number): void { this.show(message, 'success', duration); }
  public error(message: string, duration?: number): void { this.show(message, 'error', duration); }
  public warning(message: string, duration?: number): void { this.show(message, 'warning', duration); }
  public info(message: string, duration?: number): void { this.show(message, 'info', duration); }
  public remove(id: string): void { this.notifications.update(current => current.filter(n => n.id !== id)); }

  loadLibraryNotifications(): void {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (!token) {
      this.libraryNotifications.set([]);
      this.unreadCount.set(0);
      return;
    }
    this.http.get<{ notifications: LibraryNotification[]; unreadCount: number }>(this.api).subscribe({
      next: response => {
        this.libraryNotifications.set(response.notifications || []);
        this.unreadCount.set(Number(response.unreadCount) || 0);
      },
      error: () => {
        this.libraryNotifications.set([]);
        this.unreadCount.set(0);
      }
    });
  }

  markAllLibraryRead(): void {
    if (!this.unreadCount()) return;
    this.http.patch(`${this.api}/read-all`, {}).subscribe({
      next: () => {
        this.libraryNotifications.update(items => items.map(item => ({ ...item, unread: false })));
        this.unreadCount.set(0);
      }
    });
  }
}