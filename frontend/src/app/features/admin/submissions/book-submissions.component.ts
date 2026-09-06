import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
export class BookSubmissionsComponent implements OnInit {
  readonly api = inject(BookApiService);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
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
    this.cdr.detectChanges();
    this.api.adminSubmissions().subscribe({
      next: (r: Book[]) => {
        this.books = r || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.loading = false;
        const msg = this.errorMessage(error, 'تعذر تحميل الطلبات.');
        this.notify.show(msg, 'error');
        this.cdr.detectChanges();
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
    this.cdr.detectChanges();

    this.api.reviewSubmission(b._id, 'approved').subscribe({
      next: () => {
        this.books = this.books.filter(x => x._id !== b._id);
        this.processing = '';
        this.notify.show('تمت الموافقة على الكتاب ونشره، وتم اعتماد المؤلف والتصنيف.', 'success');
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.processing = '';
        this.notify.show(this.errorMessage(error, 'تعذر اعتماد الكتاب.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reject(b: Book): void {
    if (!b._id || this.processing) return;
    if (!this.reason.trim()) {
      this.notify.show('اكتب سبب الرفض أولاً.', 'error');
      this.cdr.detectChanges();
      return;
    }

    this.processing = b._id;
    this.cdr.detectChanges();

    this.api.reviewSubmission(b._id, 'rejected', this.reason.trim()).subscribe({
      next: () => {
        this.books = this.books.filter(x => x._id !== b._id);
        this.reason = '';
        this.rejecting = '';
        this.processing = '';
        this.notify.show('تم رفض الطلب وإرسال السبب للمستخدم.', 'success');
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.processing = '';
        this.notify.show(this.errorMessage(error, 'تعذر رفض الطلب.'), 'error');
        this.cdr.detectChanges();
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