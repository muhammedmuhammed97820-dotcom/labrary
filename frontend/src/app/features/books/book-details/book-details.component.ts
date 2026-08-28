import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Book, BookApiService } from '../../../core/services/book-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

interface FavoriteResponse { favorite: boolean; favorites: string[]; }

@Component({
  selector: 'app-book-details', standalone: true, imports: [CommonModule, RouterLink],
  encapsulation: ViewEncapsulation.None, templateUrl: './book-details.component.html'
})
export class BookDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BookApiService);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService);

  bookId = ''; book: Book | null = null; loading = true; error = ''; favoriteBusy = false; favoriteMessage = '';

  ngOnInit(): void {
    this.bookId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.bookId) { this.error = 'معرّف الكتاب غير موجود.'; this.loading = false; return; }
    this.loadBookDetails();
  }

  private loadBookDetails(): void {
    this.api.getById(this.bookId).subscribe({
      next: book => {
        this.book = book; this.loading = false; this.cdr.detectChanges();
        this.api.addView(this.bookId).subscribe({ error: (err: unknown) => console.warn('Failed to register view count:', err) });
      },
      error: (err: unknown) => {
        const httpError = err as { error?: { message?: string } };
        this.error = httpError.error?.message || 'تعذر تحميل تفاصيل الكتاب.'; this.loading = false; this.cdr.detectChanges();
      }
    });
  }

  author(): string { return !this.book ? '—' : typeof this.book.author === 'string' ? this.book.author : this.book.author?.name || 'مؤلف غير محدد'; }
  category(): string { return !this.book ? '—' : typeof this.book.category === 'string' ? this.book.category : this.book.category?.name || 'عام'; }
  cover(): string { return this.book?.coverImage ? this.api.getFileUrl(this.book.coverImage) : 'assets/images/default-cover.svg'; }
  fileUrl(): string { return this.book?.filePath ? this.api.getFileUrl(this.book.filePath) : ''; }

  isFavorite(): boolean { const id = String(this.book?._id || ''); return !!id && (this.auth.currentUser?.favorites || []).some(f => String(f) === id); }

  toggleFavorite(): void {
    const id = String(this.book?._id || '');
    if (!id || this.favoriteBusy) return;
    if (!this.auth.isLoggedIn) { this.favoriteMessage = 'سجّل الدخول أولًا لإضافة الكتاب إلى المفضلة.'; return; }
    this.favoriteBusy = true; this.favoriteMessage = '';
    this.http.post<FavoriteResponse>(`${environment.apiUrl}/auth/favorites/${id}/toggle`, {}).subscribe({
      next: response => {
        const user = this.auth.currentUser;
        if (user) this.auth.updateUser({ ...user, favorites: (response.favorites || []).map(String) });
        this.favoriteMessage = response.favorite ? 'تمت إضافة الكتاب إلى المفضلة ✓' : 'تمت إزالة الكتاب من المفضلة ✓';
        this.favoriteBusy = false; this.cdr.detectChanges();
        setTimeout(() => { this.favoriteMessage = ''; this.cdr.detectChanges(); }, 2500);
      },
      error: (err: unknown) => { console.error('Favorite error:', err); this.favoriteMessage = 'تعذر تحديث المفضلة. حاول مرة أخرى.'; this.favoriteBusy = false; this.cdr.detectChanges(); }
    });
  }

  download(): void {
    if (this.bookId) window.open(this.api.getDownloadUrl(this.bookId), '_blank', 'noopener,noreferrer');
  }
}
