import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  public readonly notifications = signal<ToastNotification[]>([]);

  public show(message: string, type: NotificationType = 'info', duration: number = 3000): void {
    const id = Math.random().toString(36).substring(2, 9);
    const notification: ToastNotification = { id, message, type, duration };

    this.notifications.update(current => [...current, notification]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  public success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  public error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  public warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  public info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  public remove(id: string): void {
    this.notifications.update(current => current.filter(n => n.id !== id));
  }
}