import { Injectable, signal } from '@angular/core';

export interface CurrentUser {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userKey = 'library_user';
  private readonly tokenKey = 'token';

  readonly user = signal<CurrentUser | null>(this.readUser());

  get currentUser(): CurrentUser | null { return this.user(); }
  get token(): string | null { return localStorage.getItem(this.tokenKey) ?? localStorage.getItem('accessToken'); }
  get isAdmin(): boolean { return this.user()?.role?.toLowerCase() === 'admin'; }
  get isLoggedIn(): boolean { return !!this.token && !!this.user(); }

  setSession(token: string, user: CurrentUser): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.user.set(user);
  }

  setUser(user: CurrentUser | null): void {
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
      this.user.set(user);
    } else {
      localStorage.removeItem(this.userKey);
      this.user.set(null);
    }
  }

  updateUser(user: CurrentUser): void { this.setUser(user); }

  logout(): void {
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('user');
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('accessToken');
    this.user.set(null);
  }

  private readUser(): CurrentUser | null {
    try {
      const raw = localStorage.getItem(this.userKey) ?? localStorage.getItem('user');
      return raw ? JSON.parse(raw) as CurrentUser : null;
    } catch { return null; }
  }
}
