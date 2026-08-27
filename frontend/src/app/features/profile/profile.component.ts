import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, CurrentUser } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = 'http://localhost:5000/api';

  user: CurrentUser | null = this.auth.currentUser;
  name = this.user?.name || '';
  avatar: string | null = this.user?.avatar || null;
  saving = false;
  message = '';
  error = '';

  get initial(): string { return this.name.trim().charAt(0) || 'م'; }
  get favoriteCount(): number { return this.user?.favorites?.length || 0; }

  chooseAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.error = 'اختر صورة صالحة.'; return; }
    if (file.size > 1800000) { this.error = 'حجم الصورة يجب أن يكون أقل من 1.8MB.'; return; }

    const reader = new FileReader();
    reader.onload = () => {
      this.avatar = String(reader.result);
      this.error = '';
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void { this.avatar = null; }

  save(): void {
    if (this.saving) return;
    const cleanName = this.name.trim();
    if (!cleanName) { this.error = 'الاسم مطلوب.'; return; }

    this.saving = true;
    this.message = '';
    this.error = '';

    this.http.put<{ message: string; user: CurrentUser }>(`${this.api}/auth/profile`, {
      name: cleanName,
      avatar: this.avatar
    }).subscribe({
      next: response => {
        this.user = response.user;
        this.name = response.user.name;
        this.avatar = response.user.avatar || null;
        this.auth.updateUser(response.user);
        this.message = 'تم حفظ الملف الشخصي بنجاح ✓';
        this.saving = false;
      },
      error: err => {
        this.error = err?.error?.message || 'تعذر حفظ التغييرات.';
        this.saving = false;
      }
    });
  }
}
