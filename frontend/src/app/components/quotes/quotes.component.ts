import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, timeout } from 'rxjs';
import { CommunityService, Quote } from '../../core/services/community.service';
import { BookApiService, Book } from '../../core/services/book-api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-quotes', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quotes.component.html', styleUrl: './quotes.component.scss', changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuotesComponent implements OnInit {
  private readonly service = inject(CommunityService);
  private readonly bookApi = inject(BookApiService);
  private readonly notify = inject(NotificationService);
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  readonly quotes = signal<Quote[]>([]);
  readonly filteredQuotes = signal<Quote[]>([]);
  readonly books = signal<Book[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly showComposer = signal(false);
  readonly showDeleteModal = signal(false);
  readonly showReportModal = signal(false);
  readonly editingId = signal('');
  readonly quoteText = signal('');
  readonly quoteType = signal<'general' | 'book'>('general');
  readonly selectedBookId = signal('');
  readonly pendingQuote = signal<Quote | null>(null);
  readonly reportReason = signal('other');
  readonly reportNote = signal('');
  readonly reporting = signal(false);
  readonly deleting = signal(false);
  readonly liking = new Set<string>();

  search = '';
  sort = 'latest';
  typeFilter = 'all';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.loadFailed.set(false);
    forkJoin({ quotes: this.service.quotes(), books: this.bookApi.getAll(1, 100) }).pipe(timeout(12000)).subscribe({
      next: ({ quotes, books }) => {
        this.quotes.set(quotes ?? []);
        this.books.set((books ?? []).filter(book => !!book._id));
        this.applyFilters(); this.loading.set(false);
      },
      error: e => {
        this.quotes.set([]); this.filteredQuotes.set([]); this.loading.set(false); this.loadFailed.set(true);
        this.notify.error(e?.error?.message || 'تعذر تحميل الاقتباسات.');
      }
    });
  }

  openComposer(): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول لإضافة اقتباس.');
    this.editingId.set(''); this.quoteText.set(''); this.quoteType.set('general'); this.selectedBookId.set(''); this.showComposer.set(true);
  }

  startEdit(q: Quote): void {
    if (!this.isOwner(q)) return this.notify.error('لا يمكنك تعديل اقتباس مستخدم آخر.');
    this.editingId.set(q._id); this.quoteText.set(q.text); this.quoteType.set(q.book ? 'book' : 'general'); this.selectedBookId.set(this.bookId(q)); this.showComposer.set(true);
  }

  cancelComposer(): void {
    if (this.saving()) return;
    this.showComposer.set(false); this.editingId.set(''); this.quoteText.set(''); this.quoteType.set('general'); this.selectedBookId.set('');
  }

  saveQuote(): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول أولاً.');
    const text = this.quoteText().trim();
    if (!text) return this.notify.warning('اكتب نص الاقتباس.');
    if (text.length < 3) return this.notify.warning('نص الاقتباس قصير جدًا.');
    const editing = this.editingId();
    if (editing) {
      this.saving.set(true);
      this.service.updateQuote(editing, text).pipe(timeout(12000)).subscribe({
        next: quote => { this.quotes.set(this.quotes().map(q => q._id === quote._id ? quote : q)); this.applyFilters(); this.saving.set(false); this.notify.success('تم تعديل الاقتباس.'); this.cancelComposer(); },
        error: e => { this.saving.set(false); this.notify.error(e?.error?.message || 'تعذر حفظ الاقتباس.'); }
      });
      return;
    }
    const bookId = this.quoteType() === 'book' ? this.selectedBookId() : null;
    if (this.quoteType() === 'book' && !bookId) return this.notify.warning('اختر الكتاب المرتبط بالاقتباس.');
    this.saving.set(true);
    this.service.addQuote(bookId, text).pipe(timeout(12000)).subscribe({
      next: quote => { this.quotes.set([quote, ...this.quotes()]); this.applyFilters(); this.saving.set(false); this.notify.success(bookId ? 'تمت إضافة اقتباس مرتبط بالكتاب.' : 'تمت إضافة الاقتباس العام.'); this.cancelComposer(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message || 'تعذر إضافة الاقتباس.'); }
    });
  }

  askDelete(q: Quote): void {
    if (!this.isOwner(q)) return this.notify.error('لا يمكنك حذف اقتباس مستخدم آخر.');
    this.pendingQuote.set(q); this.showDeleteModal.set(true);
  }

  cancelDelete(): void { if (!this.deleting()) { this.showDeleteModal.set(false); this.pendingQuote.set(null); } }

  confirmDelete(): void {
    const q = this.pendingQuote(); if (!q || this.deleting()) return;
    this.deleting.set(true);
    this.service.deleteQuote(q._id).pipe(timeout(12000)).subscribe({
      next: r => { this.quotes.set(this.quotes().filter(item => item._id !== q._id)); this.applyFilters(); this.deleting.set(false); this.showDeleteModal.set(false); this.pendingQuote.set(null); this.notify.success(r.message); },
      error: e => { this.deleting.set(false); this.notify.error(e?.error?.message || 'تعذر حذف الاقتباس.'); }
    });
  }

  openReport(q: Quote): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول للإبلاغ.');
    this.pendingQuote.set(q); this.reportReason.set('other'); this.reportNote.set(''); this.showReportModal.set(true);
  }

  cancelReport(): void { if (!this.reporting()) { this.showReportModal.set(false); this.pendingQuote.set(null); } }

  submitReport(): void {
    const q = this.pendingQuote(); if (!q || this.reporting()) return;
    this.reporting.set(true);
    this.service.report('quote', q._id, this.reportReason(), this.reportNote().trim()).pipe(timeout(12000)).subscribe({
      next: r => { this.reporting.set(false); this.showReportModal.set(false); this.pendingQuote.set(null); this.notify.success(r.message); },
      error: e => { this.reporting.set(false); this.notify.error(e?.error?.message || 'تعذر إرسال البلاغ.'); }
    });
  }

  isOwner(q: Quote): boolean {
    const current = this.auth.user(); const currentId = current?._id || current?.id;
    return !!currentId && String(currentId) === String(q.user?._id);
  }

  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    let items = [...this.quotes()];
    if (this.typeFilter === 'general') items = items.filter(q => !this.bookId(q));
    if (this.typeFilter === 'book') items = items.filter(q => !!this.bookId(q));
    if (term) items = items.filter(q => q.text.toLowerCase().includes(term) || q.user?.name?.toLowerCase().includes(term) || this.bookTitle(q).toLowerCase().includes(term));
    if (this.sort === 'likes') items.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    else items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.filteredQuotes.set(items);
  }

  bookId(q: Quote): string { return typeof q.book === 'string' ? q.book : q.book?._id || ''; }
  bookTitle(q: Quote): string { return typeof q.book === 'string' ? 'كتاب' : q.book?.title || ''; }

  toggleLike(q: Quote): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول للإعجاب.');
    if (this.liking.has(q._id)) return;
    this.liking.add(q._id);
    this.service.toggleLike('quote', q._id).pipe(timeout(12000)).subscribe({
      next: result => { q.liked = result.liked; q.likesCount = result.likesCount; this.liking.delete(q._id); this.quotes.set([...this.quotes()]); this.applyFilters(); },
      error: e => { this.liking.delete(q._id); this.notify.error(e?.error?.message || 'تعذر تسجيل الإعجاب.'); }
    });
  }

  isLiking(id: string): boolean { return this.liking.has(id); }
}
