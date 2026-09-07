import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';

interface SubmissionBook {
  _id?: string;
  id?: string | number;
  title?: string;
  description?: string;
  coverImage?: string;
  author?: { name?: string; _id?: string } | string | null;
  submittedAuthorName?: string;
  status?: string;
  rejectionReason?: string;
}

@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './my-submissions.component.html',
  styleUrl: './my-submissions.component.scss'
})
export class MySubmissionsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly themeService = inject(ThemeService);

  private readonly serverOrigin = 'http://localhost:5000';

  books: SubmissionBook[] = [];
  loading = true;
  error = '';
  deletingId = '';
  pendingDeleteBook: SubmissionBook | null = null;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';

    const url = `${this.serverOrigin}/api/books/my-submissions`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.books = Array.isArray(res) ? res : (res.books ?? res.data ?? []);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Fetch submissions error:', err);
        this.error = err?.error?.message || 'تعذر جلب طلبات الكتب، يرجى المحاولة لاحقاً.';
        this.loading = false;
        this.notify.show(this.error, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  getFileUrl(cover: string): string {
    if (!cover) return '';
    if (/^data:|^blob:|^https?:\/\//i.test(cover)) return cover;
    return `${this.serverOrigin}${cover.startsWith('/') ? cover : `/${cover}`}`;
  }

  author(book: SubmissionBook): string {
    if (typeof book.author === 'string' && book.author.trim()) return book.author.trim();
    if (book.author && typeof book.author === 'object' && book.author.name?.trim()) return book.author.name.trim();
    if (book.submittedAuthorName?.trim()) return book.submittedAuthorName.trim();
    return 'مؤلف غير محدد';
  }

  status(book: SubmissionBook): string {
    switch (book.status) {
      case 'approved': return 'تم القبول';
      case 'rejected': return 'مرفوض';
      default: return 'قيد المراجعة';
    }
  }

  requestDelete(book: SubmissionBook): void {
    if (book.status !== 'rejected' || !book._id || this.deletingId) return;
    this.pendingDeleteBook = book;
  }

  cancelDelete(): void {
    if (this.deletingId) return;
    this.pendingDeleteBook = null;
  }

  confirmDelete(): void {
    const book = this.pendingDeleteBook;
    if (!book || book.status !== 'rejected' || !book._id || this.deletingId) return;

    const id = book._id;
    this.deletingId = id;
    this.pendingDeleteBook = null;

    this.http.delete(`${this.serverOrigin}/api/books/${id}/my-rejected-submission`).subscribe({
      next: (res: any) => {
        this.books = this.books.filter(item => item._id !== id);
        this.deletingId = '';
        this.notify.show(res?.message || 'تم حذف الطلب المرفوض بنجاح.', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Delete rejected submission error:', err);
        this.deletingId = '';
        this.notify.show(err?.error?.message || 'تعذر حذف الطلب المرفوض.', 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
