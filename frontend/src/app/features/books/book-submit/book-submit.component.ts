import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookApiService } from '../../../core/services/book-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-book-submit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './book-submit.component.html',
  styleUrl: './book-submit.component.scss'
})
export class BookSubmitComponent {
  private readonly api = inject(BookApiService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef); // <--- أضفنا حقن كاشف التغييرات
  public readonly themeService = inject(ThemeService);

  form = { title: '', author: '', category: '', description: '', publishedYear: '' };
  bookFile: File | null = null;
  coverImage: File | null = null;
  coverPreviewUrl: string | null = null;
  submitting = false;

  onBookFile(event: Event): void {
    this.bookFile = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.cdr.detectChanges();
  }

  onCover(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.coverImage = file;
    if (!file) {
      this.coverPreviewUrl = null;
      this.cdr.detectChanges();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.coverPreviewUrl = reader.result as string;
      this.cdr.detectChanges(); // <--- تحديث المعاينة فور تحميل الصورة
    };
    reader.readAsDataURL(file);
  }

  submit(): void {
    if (!this.form.title.trim() || !this.form.author.trim() || !this.form.category.trim() || !this.bookFile || !this.coverImage) {
      this.notify.show('أكمل البيانات واختر ملف PDF والغلاف.', 'error');
      return;
    }

    const data = new FormData();
    Object.entries(this.form).forEach(([key, value]) => data.append(key, value));
    data.append('bookFile', this.bookFile);
    data.append('coverImage', this.coverImage);
    this.submitting = true;
    this.cdr.detectChanges(); // <--- تحديث حالة الزر ليظهر علامة التحميل

    this.api.submitBook(data).subscribe({
      next: (response: any) => {
        this.submitting = false;
        this.notify.show(response?.message || 'تم إرسال الكتاب للمراجعة.', 'success');
        this.cdr.detectChanges(); // <--- إعادة الزر لحالته الطبيعية
        this.router.navigate(['/my-submissions']);
      },
      error: (error: unknown) => {
        this.submitting = false;
        const message = error && typeof error === 'object' && 'error' in error
          ? ((error as { error?: { message?: string } }).error?.message || 'تعذر إرسال الكتاب.')
          : 'تعذر إرسال الكتاب.';
        this.notify.show(message, 'error');
        this.cdr.detectChanges(); // <--- إيقاف التحميل وإظهار الخطأ
      }
    });
  }
}