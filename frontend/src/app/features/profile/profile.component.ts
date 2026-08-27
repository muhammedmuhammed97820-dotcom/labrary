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
  private readonly serverOrigin = 'http://localhost:5000';

  user: CurrentUser | null = this.auth.currentUser;
  name = this.user?.name || '';
  avatar: string | null = this.user?.avatar || null;
  avatarFile: File | null = null;
  avatarRemoved = false;
  saving = false;
  message = '';
  error = '';

  get initial(): string { return this.name.trim().charAt(0) || 'م'; }
  get favoriteCount(): number { return this.user?.favorites?.length || 0; }

  get avatarUrl(): string | null {
    if (!this.avatar) return null;
    if (this.avatar.startsWith('data:') || this.avatar.startsWith('blob:') || this.avatar.startsWith('http')) return this.avatar;
    return `${this.serverOrigin}${this.avatar}`;
  }

  chooseAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'اختر صورة JPG أو PNG أو WEBP.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.error = 'حجم الصورة يجب أن يكون أقل من 5MB.';
      input.value = '';
      return;
    }

    this.avatarFile = file;
    this.avatarRemoved = false;
    this.message = '';
    this.error = '';

    const reader = new FileReader();
    reader.onload = () => this.avatar = String(reader.result);
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatar = null;
    this.avatarFile = null;
    this.avatarRemoved = true;
    this.message = '';
    this.error = '';
  }

  save(): void {
    if (this.saving) return;

    const cleanName = this.name.trim();
    if (!cleanName) {
      this.message = '';
      this.error = 'الاسم مطلوب.';
      return;
    }

    this.saving = true;
    this.message = '';
    this.error = '';

    const hasFileChange = !!this.avatarFile || this.avatarRemoved;
    const requestBody: FormData | { name: string } = hasFileChange
      ? this.buildFormData(cleanName)
      : { name: cleanName };

    this.http.put<{ message: string; user: CurrentUser }>(`${this.api}/auth/profile`, requestBody).subscribe({
      next: response => {
        this.user = response.user;
        this.name = response.user.name;
        this.avatar = response.user.avatar || null;
        this.avatarFile = null;
        this.avatarRemoved = false;
        this.auth.updateUser(response.user);
        this.message = 'تم الحفظ بنجاح ✓';
        this.error = '';
        this.saving = false;
      },
      error: err => {
        this.message = '';
        this.error = err?.error?.message || 'تعذر حفظ التغييرات. تأكد من تشغيل الخادم ثم حاول مرة أخرى.';
        this.saving = false;
      }
    });
  }

  private buildFormData(cleanName: string): FormData {
    const formData = new FormData();
    formData.append('name', cleanName);

    if (this.avatarFile) {
      formData.append('avatar', this.avatarFile, this.avatarFile.name);
    } else if (this.avatarRemoved) {
      formData.append('removeAvatar', 'true');
    }

    return formData;
  }
}
