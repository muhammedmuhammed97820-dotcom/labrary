import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../../core/services/book-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-book-submissions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './book-submissions.component.html',
  styleUrl: './book-submissions.component.scss'
})
export class BookSubmissionsComponent {
  readonly api = inject(BookApiService);
  private notify = inject(NotificationService);
  public readonly themeService = inject(ThemeService);

  books: Book[] = [];
  loading = true;
  processing = '';
  rejecting = '';
  reason = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.adminSubmissions().subscribe({
      next: (r: Book[]) => {
        this.books = r || [];
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        const msg = this.errorMessage(error, 'تعذر تحميل الطلبات.');
        this.notify.show(msg, 'error');
      }
    });
  }

  author(b: Book): string {
    if (typeof b.author === 'string') return b.author;
    return b.author?.name || b.submittedAuthorName || '—';
  }

  category(b: Book): string {
    if (typeof b.category === 'string') return b.category;
    return b.category?.name || b.submittedCategoryName || '—';
  }

  approve(b: Book): void {
    if (!b._id || this.processing) return;
    this.processing = b._id;
    this.api.reviewSubmission(b._id, 'approved').subscribe({
      next: () => {
        this.books = this.books.filter(x => x._id !== b._id);
        this.processing = '';
        this.notify.show('تمت الموافقة على الكتاب ونشره، وتم اعتماد المؤلف والتصنيف.', 'success');
      },
      error: (error: unknown) => {
        this.processing = '';
        this.notify.show(this.errorMessage(error, 'تعذر اعتماد الكتاب.'), 'error');
      }
    });
  }

  reject(b: Book): void {
    if (!b._id || this.processing) return;
    if (!this.reason.trim()) {
      this.notify.show('اكتب سبب الرفض أولاً.', 'error');
      return;
    }

    this.processing = b._id;
    this.api.reviewSubmission(b._id, 'rejected', this.reason.trim()).subscribe({
      next: () => {
        this.books = this.books.filter(x => x._id !== b._id);
        this.reason = '';
        this.rejecting = '';
        this.processing = '';
        this.notify.show('تم رفض الطلب وإرسال السبب للمستخدم.', 'success');
      },
      error: (error: unknown) => {
        this.processing = '';
        this.notify.show(this.errorMessage(error, 'تعذر رفض الطلب.'), 'error');
      }
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const body = (error as { error?: { message?: string } }).error;
      return body?.message || fallback;
    }
    return fallback;
  }
}
