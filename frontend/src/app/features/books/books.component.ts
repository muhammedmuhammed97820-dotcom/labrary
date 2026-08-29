import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

interface Book {
  _id?: string;
  id?: string | number;
  title?: string;
  description?: string;
  coverImage?: string;
  coverUrl?: string;
  author?: { name?: string } | string;
  category?: { name?: string } | string;
  views?: number;
  viewsCount?: number; // تمت الإضافه لضمان التوافق مع الـ API
  downloads?: number;
  publishedYear?: number | string;
  isAvailable?: boolean;
}

interface FavoriteResponse {
  favorite: boolean;
  favorites: string[];
}

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly themeService = inject(ThemeService);
  private readonly serverOrigin = 'http://localhost:5000';

  books: Book[] = [];
  query = '';
  loading = true;
  error = '';
  favoriteBusy = new Set<string>();

  ngOnInit(): void {
    this.load(false);
  }

  get filteredBooks(): Book[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.books;
    return this.books.filter(book => {
      const author = typeof book.author === 'string' ? book.author : book.author?.name;
      const category = typeof book.category === 'string' ? book.category : book.category?.name;
      return [book.title, author, category, book.description].some(v => String(v ?? '').toLowerCase().includes(q));
    });
  }

  load(showNotify = true): void {
    this.loading = true;
    this.error = '';
    this.http.get<any>(`${this.serverOrigin}/api/books`).subscribe({
      next: r => {
        this.books = Array.isArray(r) ? r : (r.books ?? r.data ?? []);
        this.loading = false;
        if (showNotify) {
          this.notify.show('تم تحديث قائمة الكتب بنجاح.', 'info');
        }
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Fetch books error:', err);
        this.error = err?.error?.message || 'تعذر الاتصال بالمكتبة الرقمية.';
        this.loading = false;
        this.notify.show(this.error, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  getBookId(book: any): string {
    return String(book?._id ?? book?.id ?? '');
  }

  authorName(book: Book): string {
    return typeof book.author === 'string' ? book.author : book.author?.name || 'مؤلف غير محدد';
  }

  categoryName(book: Book): string {
    return typeof book.category === 'string' ? book.category : book.category?.name || 'عام';
  }

  getBookCover(book: any): string | null {
    const cover = book?.coverImage || book?.coverUrl || book?.cover;
    if (!cover) return null;
    if (/^data:|^blob:|^https?:\/\//i.test(cover)) return cover;
    return `${this.serverOrigin}${cover.startsWith('/') ? cover : `/${cover}`}`;
  }

  isFavorite(book: Book): boolean {
    const targetId = this.getBookId(book);
    if (!targetId) return false;
    const user = this.auth.currentUser;
    const favorites = user?.favorites || [];
    return favorites.some((f: any) => String(f?._id || f?.id || f) === targetId);
  }

  toggleFavorite(book: Book): void {
    const bookId = this.getBookId(book);
    if (!bookId || this.favoriteBusy.has(bookId)) return;

    if (!this.auth.isLoggedIn) {
      this.notify.show('سجّل الدخول أولًا لإضافة الكتب إلى المفضلة.', 'error');
      return;
    }

    this.favoriteBusy.add(bookId);
    this.http.post<FavoriteResponse>(`${this.serverOrigin}/api/auth/favorites/${bookId}/toggle`, {}).subscribe({
      next: r => {
        const user = this.auth.currentUser;
        if (user) {
          this.auth.updateUser({ ...user, favorites: (r.favorites || []).map(String) });
        }
        const msg = r.favorite ? 'تمت إضافة الكتاب إلى المفضلة ✓' : 'تمت إزالة الكتاب من المفضلة ✓';
        this.notify.show(msg, 'success');
        this.favoriteBusy.delete(bookId);
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Toggle favorite error:', err);
        this.notify.show('تعذر تحديث المفضلة. حاول مرة أخرى.', 'error');
        this.favoriteBusy.delete(bookId);
        this.cdr.detectChanges();
      }
    });
  }

  isFavoriteBusy(b: Book): boolean {
    return this.favoriteBusy.has(this.getBookId(b));
  }
}