import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookApiService } from '../../../core/services/book-api.service';
import { NotificationService } from '../../../core/services/notification.service';

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

  form = { title: '', author: '', category: '', description: '', publishedYear: '' };
  bookFile: File | null = null;
  coverImage: File | null = null;
  coverPreviewUrl: string | null = null;
  submitting = false;

  onBookFile(event: Event): void {
    this.bookFile = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  onCover(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.coverImage = file;
    if (!file) {
      this.coverPreviewUrl = null;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.coverPreviewUrl = reader.result as string;
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

    this.api.submitBook(data).subscribe({
      next: response => {
        this.submitting = false;
        this.notify.show(response.message || 'تم إرسال الكتاب للمراجعة.', 'success');
        this.router.navigate(['/my-submissions']);
      },
      error: (error: unknown) => {
        this.submitting = false;
        const message = error && typeof error === 'object' && 'error' in error
          ? ((error as { error?: { message?: string } }).error?.message || 'تعذر إرسال الكتاب.')
          : 'تعذر إرسال الكتاب.';
        this.notify.show(message, 'error');
      }
    });
  }
}
