import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, CurrentUser } from '../../core/services/auth.service';

interface AuthResponse { token: string; user: CurrentUser; }

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  mode: 'login' | 'register' = 'login'; name = ''; email = ''; password = ''; showPassword = false; loading = false; error = ''; success = '';
  submit(): void {
    if (this.loading) return; this.error = ''; this.success = '';
    if (this.mode === 'register' && !this.name.trim()) { this.error = 'يرجى إدخال الاسم.'; return; }
    if (!this.email.trim() || !this.password) { this.error = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.'; return; }
    if (this.password.length < 6) { this.error = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'; return; }
    this.loading = true; const isLogin = this.mode === 'login'; const endpoint = isLogin ? '/login' : '/register';
    const body = isLogin ? { email: this.email.trim(), password: this.password } : { name: this.name.trim(), email: this.email.trim(), password: this.password };
    this.http.post<AuthResponse>(`http://localhost:5000/api/auth${endpoint}`, body).subscribe({
      next: response => { this.auth.setSession(response.token, response.user); this.loading = false; this.success = isLogin ? 'تم تسجيل الدخول بنجاح ✓' : 'تم إنشاء الحساب بنجاح ✓'; setTimeout(() => this.router.navigateByUrl(response.user.role === 'admin' ? '/admin' : '/books'), 700); },
      error: err => { this.loading = false; const message = err?.error?.message || err?.error?.error; this.error = message || (isLogin ? 'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.' : 'تعذر إنشاء الحساب. حاول مرة أخرى.'); }
    });
  }
  switchMode(): void { if (this.loading) return; this.mode = this.mode === 'login' ? 'register' : 'login'; this.error = ''; this.success = ''; }
}
