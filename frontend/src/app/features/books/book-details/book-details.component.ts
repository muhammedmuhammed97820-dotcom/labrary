import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Book, BookApiService } from '../../../core/services/book-api.service';
import { AuthService } from '../../../core/services/auth.service';

interface FavoriteResponse { favorite: boolean; favorites: string[]; }

@Component({ selector: 'app-book-details', standalone: true, imports: [CommonModule, RouterLink], templateUrl: './book-details.component.html', styleUrl: './book-details.component.scss' })
export class BookDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BookApiService);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService);
  bookId = ''; book: Book | null = null; loading = true; error = ''; favoriteBusy = false; favoriteMessage = '';

  ngOnInit(): void {
    this.bookId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.bookId) { this.error = 'معرّف الكتاب غير موجود.'; this.loading = false; this.cdr.detectChanges(); return; }
    this.loadBookDetails();
  }

  private loadBookDetails(): void {
    this.loading = true;
    this.error = '';
    this.api.getById(this.bookId).subscribe({
      next: book => {
        this.book = book;
        this.loading = false;
        this.cdr.detectChanges();
        if (this.bookId) {
          this.api.addView(this.bookId).subscribe({ error: err => console.warn('Failed to register view count:', err) });
        }
      },
      error: err => {
        console.error('Book details error:', err);
        this.error = err?.error?.message || 'تعذر تحميل تفاصيل الكتاب.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
  author(): string { if (!this.book) return '—'; return typeof this.book.author === 'string' ? this.book.author : this.book.author?.name || 'مؤلف غير محدد'; }
  category(): string { if (!this.book) return '—'; return typeof this.book.category === 'string' ? this.book.category : this.book.category?.name || 'عام'; }
  cover(): string { const value = this.book?.coverImage; if (!value) return 'assets/images/default-cover.svg'; if (/^https?:\/\//i.test(value)) return value; return `http://localhost:5000${value.startsWith('/') ? value : `/${value}`}`; }
  fileUrl(): string { const value = this.book?.filePath; if (!value) return ''; if (/^https?:\/\//i.test(value)) return value; return `http://localhost:5000${value.startsWith('/') ? value : `/${value}`}`; }
  isFavorite(): boolean { const id = String(this.book?._id || ''); return !!id && (this.auth.currentUser?.favorites || []).some(f => String(f) === id); }
  toggleFavorite(): void {
    const id = String(this.book?._id || '');
    if (!id || this.favoriteBusy) return;
    if (!this.auth.isLoggedIn) { this.favoriteMessage = 'سجّل الدخول أولًا لإضافة الكتاب إلى المفضلة.'; return; }
    this.favoriteBusy = true; this.favoriteMessage = '';
    this.http.post<FavoriteResponse>(`http://localhost:5000/api/auth/favorites/${id}/toggle`, {}).subscribe({
      next: r => { this.auth.updateUser({ ...this.auth.currentUser!, favorites: (r.favorites || []).map(String) }); this.favoriteMessage = r.favorite ? 'تمت إضافة الكتاب إلى المفضلة ✓' : 'تمت إزالة الكتاب من المفضلة ✓'; this.favoriteBusy = false; this.cdr.detectChanges(); setTimeout(() => { this.favoriteMessage = ''; this.cdr.detectChanges(); }, 2500); },
      error: () => { this.favoriteMessage = 'تعذر تحديث المفضلة. حاول مرة أخرى.'; this.favoriteBusy = false; this.cdr.detectChanges(); }
    });
  }
  download(): void { const url = this.fileUrl(); if (!url || !this.bookId) return; this.api.addDownload(this.bookId).subscribe({ error: err => console.warn('Failed to register download count:', err) }); const link = document.createElement('a'); link.href = url; link.download = `${this.book?.title || 'book'}.pdf`; link.target = '_blank'; link.rel = 'noopener'; link.click(); }
}
