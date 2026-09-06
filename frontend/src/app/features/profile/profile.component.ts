import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, CurrentUser } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef); // <--- أضفنا كاشف التغييرات
  public readonly themeService = inject(ThemeService);
  
  private readonly api = 'http://localhost:5000/api';
  private readonly serverOrigin = 'http://localhost:5000';

  user: CurrentUser | null = this.auth.currentUser;
  name = this.user?.name || '';
  avatar: string | null = this.user?.avatar || null;
  avatarFile: File | null = null;
  avatarRemoved = false;
  saving = false;
  error = '';

  get initial(): string {
    return this.name.trim().charAt(0) || 'م';
  }

  get favoriteCount(): number {
    return this.user?.favorites?.length || 0;
  }

  get avatarUrl(): string | null {
    if (!this.avatar) return null;
    if (/^data:|^blob:|^https?:\/\//i.test(this.avatar)) {
      return this.avatar;
    }
    return `${this.serverOrigin}${this.avatar.startsWith('/') ? this.avatar : `/${this.avatar}`}`;
  }

  resetAvatarInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = '';
  }

  chooseAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'اختر صورة بصيغة JPG أو PNG أو WEBP.';
      this.notify.show(this.error, 'error');
      input.value = '';
      this.cdr.detectChanges(); // <--- تحديث الواجهة عند الخطأ
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.error = 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت.';
      this.notify.show(this.error, 'error');
      input.value = '';
      this.cdr.detectChanges(); // <--- تحديث الواجهة عند الخطأ
      return;
    }

    this.avatarFile = file;
    this.avatarRemoved = false;
    this.error = '';

    const reader = new FileReader();
    reader.onload = () => {
      this.avatar = String(reader.result);
      this.cdr.detectChanges(); // <--- تحديث واجهة المعاينة فور تحميل قراءة الملف
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatar = null;
    this.avatarFile = null;
    this.avatarRemoved = true;
    this.error = '';
    this.cdr.detectChanges(); // <--- تحديث الواجهة عند الحذف
  }

  save(): void {
    if (this.saving) return;
    const cleanName = this.name.trim();
    if (!cleanName) {
      this.error = 'حقل الاسم الكامل مطلوب.';
      this.notify.show(this.error, 'error');
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.error = '';
    this.cdr.detectChanges(); // <--- تفعيل حالة التحميل للزر فور الضغط

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
        
        this.notify.show('تم حفظ التغييرات بنجاح ✓', 'success');
        this.saving = false;
        this.cdr.detectChanges(); // <--- إيقاف التحميل وتحديث واجهة المستخدم بنجاح
      },
      error: err => {
        this.error = err?.error?.message || 'تعذر حفظ التغييرات. تأكد من تشغيل الخادم ثم حاول مرة أخرى.';
        this.notify.show(this.error, 'error');
        this.saving = false;
        this.cdr.detectChanges(); // <--- إيقاف التحميل وإظهار رسالة الخطأ فوراً
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