import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BookApiService } from '../../core/services/book-api.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface CatalogBook {
  _id?: string;
  id?: string | number;
  title?: string;
  description?: string;
  coverImage?: string;
  coverUrl?: string;
  author?: { name?: string } | string;
  category?: { name?: string } | string;
  views?: number;
  viewsCount?: number;
  downloads?: number;
  publishedYear?: number;
  rating?: number;
  isAvailable?: boolean;
}

interface FavoriteResponse { favorite: boolean; favorites: string[]; }

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './books.component.html'
})
export class BooksComponent implements OnInit {
  private readonly api = inject(BookApiService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  books: CatalogBook[] = [];
  filtered: CatalogBook[] = [];
  search = '';
  loading = true;
  error = '';
  favoriteMessage = '';
  favoriteBusy = new Set<string>();
  page = 1;
  limit = 24;
  totalPages = 1;

  ngOnInit(): void { this.loadBooks(); }

  loadBooks(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();
    this.api.getAll(this.page, this.limit, this.search.trim()).subscribe({
      next: response => {
        const payload = response as unknown as { books?: CatalogBook[]; pagination?: { pages?: number } } | CatalogBook[];
        if (Array.isArray(payload)) {
          this.books = payload;
          this.totalPages = 1;
        } else {
          this.books = Array.isArray(payload.books) ? payload.books : [];
          this.totalPages = Math.max(Number(payload.pagination?.pages) || 1, 1);
        }
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Books load error:', err);
        const httpError = err as { error?: { message?: string } };
        this.books = [];
        this.filtered = [];
        this.totalPages = 1;
        this.error = httpError.error?.message || 'تعذر الاتصال بالمكتبة الرقمية.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  filter(): void {
    this.page = 1;
    this.applyFilter();
    if (this.search.trim()) this.loadBooks();
  }

  private applyFilter(): void {
    const query = this.search.trim().toLowerCase();
    this.filtered = !query ? [...this.books] : this.books.filter(book => `${book.title ?? ''} ${this.author(book)} ${this.category(book)}`.toLowerCase().includes(query));
  }

  previousPage(): void { if (this.page > 1) { this.page--; this.loadBooks(); } }
  nextPage(): void { if (this.page < this.totalPages) { this.page++; this.loadBooks(); } }
  id(book: CatalogBook): string { return String(book._id ?? book.id ?? ''); }
  author(book: CatalogBook): string { return typeof book.author === 'string' ? book.author : book.author?.name ?? 'مؤلف غير محدد'; }
  category(book: CatalogBook): string { return typeof book.category === 'string' ? book.category : book.category?.name ?? 'عام'; }
  views(book: CatalogBook): number { return Number(book.viewsCount ?? book.views ?? 0); }
  cover(book: CatalogBook): string {
    const value = book.coverImage || book.coverUrl;
    if (!value) return 'assets/images/default-cover.svg';
    if (/^https?:\/\//i.test(value)) return value;
    return `${environment.apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
  }
  isFavorite(book: CatalogBook): boolean {
    const bookId = this.id(book);
    return !!bookId && (this.auth.currentUser?.favorites || []).some(favorite => {
      const value = favorite as unknown;
      return String(value) === bookId || String((value as { _id?: string })?._id || '') === bookId;
    });
  }
  toggleFavorite(book: CatalogBook): void {
    const bookId = this.id(book);
    if (!bookId || this.favoriteBusy.has(bookId)) return;
    if (!this.auth.isLoggedIn) { this.favoriteMessage = 'سجّل الدخول أولًا لإضافة الكتاب إلى المفضلة.'; return; }
    this.favoriteBusy.add(bookId);
    this.favoriteMessage = '';
    this.http.post<FavoriteResponse>(`${environment.apiUrl}/auth/favorites/${bookId}/toggle`, {}).subscribe({
      next: response => {
        const user = this.auth.currentUser;
        if (user) this.auth.updateUser({ ...user, favorites: (response.favorites || []).map(String) });
        this.favoriteMessage = response.favorite ? 'تمت إضافة الكتاب إلى المفضلة ✓' : 'تمت إزالة الكتاب من المفضلة ✓';
        this.favoriteBusy.delete(bookId);
        this.cdr.detectChanges();
        setTimeout(() => { this.favoriteMessage = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: (err: unknown) => {
        console.error('Favorite error:', err);
        this.favoriteMessage = 'تعذر تحديث المفضلة. حاول مرة أخرى.';
        this.favoriteBusy.delete(bookId);
        this.cdr.detectChanges();
      }
    });
  }
  isFavoriteBusy(book: CatalogBook): boolean { return this.favoriteBusy.has(this.id(book)); }
}
