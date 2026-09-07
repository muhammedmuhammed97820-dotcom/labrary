import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BookApiService } from '../../core/services/book-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

interface Book {
  _id?: string;
  id?: string | number;
  title?: string;
  coverImage?: string;
  coverUrl?: string;
  author?: { name?: string } | string;
}

interface FavoriteResponse {
  favorite: boolean;
  favorites: string[];
}

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss'
})
export class FavoritesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly booksApi = inject(BookApiService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly themeService = inject(ThemeService);

  books: Book[] = [];
  loading = true;
  error = '';
  removing = new Set<string>();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const ids = (this.auth.currentUser?.favorites || []).map(String);

    if (!ids.length) {
      this.books = [];
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.http.get<any>(`${this.booksApi.getFileUrl('/api')}/books`).subscribe({
      next: r => {
        const all: Book[] = Array.isArray(r) ? r : (r.books ?? r.data ?? []);
        this.books = all.filter(b => ids.includes(this.getBookId(b)));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Favorites load error:', err);
        this.error = err?.error?.message || 'تعذر تحميل المفضلة.';
        this.loading = false;
        this.notify.show(this.error, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  getBookId(book: Book): string {
    return String(book._id ?? book.id ?? '');
  }

  authorName(book: Book): string {
    return typeof book.author === 'string' ? book.author : book.author?.name || 'مؤلف غير محدد';
  }

  getBookCover(book: Book): string {
    const cover = book.coverImage || book.coverUrl;
    return cover ? this.booksApi.getFileUrl(cover) : 'assets/images/default-cover.svg';
  }

  remove(book: Book): void {
    const id = this.getBookId(book);
    if (!id || this.removing.has(id)) return;

    this.removing.add(id);
    this.http.post<FavoriteResponse>(`${this.booksApi.getFileUrl('/api')}/auth/favorites/${id}/toggle`, {}).subscribe({
      next: r => {
        const currentUser = this.auth.currentUser;
        if (currentUser) this.auth.updateUser({ ...currentUser, favorites: (r.favorites || []).map(String) });
        this.books = this.books.filter(b => this.getBookId(b) !== id);
        this.notify.show('تمت إزالة الكتاب من المفضلة ✓', 'success');
        this.removing.delete(id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.notify.show('تعذر إزالة الكتاب من المفضلة. حاول مرة أخرى.', 'error');
        this.removing.delete(id);
        this.cdr.detectChanges();
      }
    });
  }
}
