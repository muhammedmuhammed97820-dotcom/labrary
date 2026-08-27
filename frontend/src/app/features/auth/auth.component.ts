import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, CurrentUser } from '../../core/services/auth.service';

interface AuthResponse { token: string; user: CurrentUser; }

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  mode: 'login' | 'register' = 'login';
  name = '';
  email = '';
  password = '';
  showPassword = false;
  loading = false;
  error = '';

  submit(): void {
    this.error = '';
    if (this.mode === 'register' && !this.name.trim()) { this.error = 'يرجى إدخال الاسم.'; return; }
    if (!this.email.trim() || !this.password) { this.error = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.'; return; }
    if (this.password.length < 6) { this.error = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'; return; }

    this.loading = true;
    const endpoint = this.mode === 'login' ? '/login' : '/register';
    const body = this.mode === 'login'
      ? { email: this.email.trim(), password: this.password }
      : { name: this.name.trim(), email: this.email.trim(), password: this.password };

    this.http.post<AuthResponse>(`http://localhost:5000/api/auth${endpoint}`, body).subscribe({
      next: response => {
        this.auth.setSession(response.token, response.user);
        this.loading = false;
        this.router.navigateByUrl(response.user.role === 'admin' ? '/admin' : '/books');
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || 'تعذر الاتصال بالخادم. تأكد أن الـBackend يعمل.';
      }
    });
  }

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error = '';
  }
}
