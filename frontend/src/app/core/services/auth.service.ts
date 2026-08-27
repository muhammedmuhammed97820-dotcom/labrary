import { Injectable } from '@angular/core';

export interface AuthUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userKey = 'library_user';

  get currentUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.userKey) ?? localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  get isAdmin(): boolean {
    return this.currentUser?.role?.toLowerCase() === 'admin';
  }

  setUser(user: AuthUser | null): void {
    if (user) localStorage.setItem(this.userKey, JSON.stringify(user));
    else localStorage.removeItem(this.userKey);
  }

  logout(): void {
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
  }
}
