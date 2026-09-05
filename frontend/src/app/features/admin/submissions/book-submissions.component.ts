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
      error: () => this.loading = false
    });
  } 

  author(b: Book): string {
    return typeof b.author === 'string' ? b.author : b.author?.name || '—';
  } 

  category(b: Book): string {
    return typeof b.category === 'string' ? b.category : b.category?.name || '—';
  } 

  approve(b: Book): void {
    if (!b._id) return;
    this.api.reviewSubmission(b._id, 'approved').subscribe({
      next: () => {
        this.books = this.books.filter(x => x._id !== b._id);
        this.notify.show('تمت الموافقة على الكتاب ونشره.', 'success');
      },
      error: (error: unknown) => {
        const msg = error && typeof error === 'object' && 'error' in error
          ? ((error as { error?: { message?: string } }).error?.message || 'تعذر اعتماد الكتاب.')
          : 'تعذر اعتماد الكتاب.';
        this.notify.show(msg, 'error');
      }
    });
  } 

  reject(b: Book): void {
    if (!b._id) return;
    if (!this.reason.trim()) {
      this.notify.show('اكتب سبب الرفض أولاً.', 'error');
      return;
    }
    this.api.reviewSubmission(b._id, 'rejected', this.reason.trim()).subscribe({
      next: () => {
        this.books = this.books.filter(x => x._id !== b._id);
        this.reason = '';
        this.rejecting = '';
        this.notify.show('تم رفض الطلب وإرسال السبب للمستخدم.', 'success');
      },
      error: (error: unknown) => {
        const msg = error && typeof error === 'object' && 'error' in error
          ? ((error as { error?: { message?: string } }).error?.message || 'تعذر رفض الطلب.')
          : 'تعذر رفض الطلب.';
        this.notify.show(msg, 'error');
      }
    });
  } 
}