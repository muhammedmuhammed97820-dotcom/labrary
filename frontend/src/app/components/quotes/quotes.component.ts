import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommunityService, Quote } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { BookApiService, Book } from '../../core/services/book-api.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quotes.component.html',
  styleUrl: './quotes.component.scss'
})
export class QuotesComponent implements OnInit {
  private readonly service = inject(CommunityService);
  private readonly bookService = inject(BookApiService);
  private readonly notify = inject(NotificationService);
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  quotes: Quote[] = [];
  filteredQuotes: Quote[] = [];
  books: Book[] = [];
  search = '';
  sort = 'latest';
  loading = true;
  loadingBooks = false;
  saving = false;
  showComposer = false;
  liking = new Set<string>();
  quoteText = '';
  selectedBookId = '';
  quotePage: number | null = null;

  ngOnInit(): void {
    this.load();
    if (this.auth.isLoggedIn) this.loadBooks();
  }

  load(): void {
    this.loading = true;
    this.service.quotes().subscribe({
      next: items => { this.quotes = items; this.applyFilters(); this.loading = false; },
      error: e => { this.loading = false; this.notify.error(e?.error?.message || 'تعذر تحميل الاقتباسات.'); }
    });
  }

  loadBooks(): void {
    this.loadingBooks = true;
    this.bookService.getAll(1, 100).subscribe({
      next: books => { this.books = books.filter(book => book._id && book.status !== 'rejected'); this.loadingBooks = false; },
      error: () => { this.loadingBooks = false; this.notify.error('تعذر تحميل قائمة الكتب.'); }
    });
  }

  openComposer(): void {
    if (!this.auth.isLoggedIn) {
      this.notify.warning('سجّل الدخول لإضافة اقتباس.');
      return;
    }
    this.showComposer = !this.showComposer;
    if (this.showComposer && !this.books.length && !this.loadingBooks) this.loadBooks();
  }

  cancelComposer(): void {
    if (this.saving) return;
    this.showComposer = false;
    this.quoteText = '';
    this.selectedBookId = '';
    this.quotePage = null;
  }

  addQuote(): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول لإضافة اقتباس.');
    if (!this.selectedBookId) return this.notify.warning('اختر الكتاب أولاً.');
    if (!this.quoteText.trim()) return this.notify.warning('اكتب نص الاقتباس.');
    if (this.quoteText.trim().length < 3) return this.notify.warning('نص الاقتباس قصير جدًا.');
    if (this.quotePage !== null && (!Number.isInteger(Number(this.quotePage)) || Number(this.quotePage) < 1)) return this.notify.warning('رقم الصفحة غير صحيح.');

    this.saving = true;
    this.service.addQuote({
      book: this.selectedBookId,
      text: this.quoteText.trim(),
      page: this.quotePage
    }).subscribe({
      next: quote => {
        this.quotes = [quote, ...this.quotes];
        this.applyFilters();
        this.saving = false;
        this.notify.success('تمت إضافة الاقتباس بنجاح.');
        this.cancelComposer();
      },
      error: e => {
        this.saving = false;
        this.notify.error(e?.error?.message || 'تعذر إضافة الاقتباس.');
      }
    });
  }

  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    let items = term
      ? this.quotes.filter(q => q.text.toLowerCase().includes(term) || q.book?.title?.toLowerCase().includes(term) || q.user?.name?.toLowerCase().includes(term))
      : [...this.quotes];

    if (this.sort === 'likes') items.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    else items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.filteredQuotes = items;
  }

  toggleLike(q: Quote): void {
    if (!this.auth.isLoggedIn) { this.notify.warning('سجّل الدخول للإعجاب.'); return; }
    if (this.liking.has(q._id)) return;
    this.liking.add(q._id);
    this.service.toggleLike('quote', q._id).subscribe({
      next: result => { q.liked = result.liked; q.likesCount = result.likesCount; this.liking.delete(q._id); },
      error: e => { this.liking.delete(q._id); this.notify.error(e?.error?.message || 'تعذر تسجيل الإعجاب.'); }
    });
  }

  report(q: Quote): void {
    if (!this.auth.isLoggedIn) { this.notify.warning('سجّل الدخول للإبلاغ.'); return; }
    const reason = prompt('سبب البلاغ: abuse / spam / misinformation / copyright / other', 'other') || 'other';
    const note = prompt('ملاحظة إضافية (اختياري):', '') || '';
    this.service.report('quote', q._id, reason, note).subscribe({
      next: r => this.notify.success(r.message),
      error: e => this.notify.error(e?.error?.message || 'تعذر إرسال البلاغ.')
    });
  }

  isLiking(id: string): boolean { return this.liking.has(id); }
}
