import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Book, BookApiService } from '../../../core/services/book-api.service';
import { CommunityService, Quote } from '../../../core/services/community.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface FavoriteResponse { favorite: boolean; favorites: string[]; }

@Component({
  selector: 'app-book-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './book-details.component.html',
  styleUrl: './book-details.component.scss'
})
export class BookDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BookApiService);
  private readonly community = inject(CommunityService);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly notify = inject(NotificationService);
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  bookId = '';
  book: Book | null = null;
  quotes: Quote[] = [];
  quoteText = '';
  loading = true;
  quotesLoading = true;
  error = '';
  favoriteBusy = false;
  downloadBusy = false;
  quoteSaving = false;
  private viewRequestStarted = false;

  ngOnInit(): void {
    this.bookId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.bookId) {
      this.error = 'معرّف الكتاب غير موجود.';
      this.loading = false;
      this.quotesLoading = false;
      return;
    }
    this.loadBookDetails();
  }

  private loadBookDetails(): void {
    this.api.getById(this.bookId).subscribe({
      next: book => {
        this.book = book;
        this.loading = false;
        this.cdr.detectChanges();
        this.registerViewOnce();
        this.loadQuotes();
      },
      error: (err: unknown) => {
        const httpError = err as { error?: { message?: string } };
        this.error = httpError.error?.message || 'تعذر تحميل تفاصيل الكتاب.';
        this.loading = false;
        this.quotesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadQuotes(): void {
    this.quotesLoading = true;
    this.community.quotes(this.bookId).subscribe({
      next: quotes => {
        this.quotes = quotes ?? [];
        this.quotesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.quotes = [];
        this.quotesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  addQuote(): void {
    if (!this.auth.isLoggedIn) {
      this.notify.show('سجّل الدخول أولًا لإضافة اقتباس.', 'error');
      return;
    }
    const text = this.quoteText.trim();
    if (!text) {
      this.notify.show('اكتب نص الاقتباس أولًا.', 'error');
      return;
    }
    if (!this.bookId || this.quoteSaving) return;

    this.quoteSaving = true;
    this.community.addQuote(this.bookId, text).subscribe({
      next: quote => {
        this.quotes = [quote, ...this.quotes];
        this.quoteText = '';
        this.quoteSaving = false;
        this.notify.show('تمت إضافة الاقتباس إلى هذا الكتاب ✓', 'success');
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        const httpError = err as { error?: { message?: string } };
        this.quoteSaving = false;
        this.notify.show(httpError.error?.message || 'تعذر إضافة الاقتباس.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  author(): string { return !this.book ? '—' : typeof this.book.author === 'string' ? this.book.author : this.book.author?.name || 'مؤلف غير محدد'; }
  category(): string { return !this.book ? '—' : typeof this.book.category === 'string' ? this.book.category : this.book.category?.name || 'عام'; }
  cover(): string { return this.book?.coverImage ? this.api.getFileUrl(this.book.coverImage) : 'assets/images/default-cover.svg'; }
  fileUrl(): string { return this.book?.filePath ? this.api.getFileUrl(this.book.filePath) : ''; }

  isFavorite(): boolean {
    const id = String(this.book?._id || '');
    return !!id && (this.auth.currentUser?.favorites || []).some(f => String(f) === id);
  }

  toggleFavorite(): void {
    const id = String(this.book?._id || '');
    if (!id || this.favoriteBusy) return;
    if (!this.auth.isLoggedIn) {
      this.notify.show('سجّل الدخول أولًا لإضافة الكتب إلى المفضلة.', 'error');
      return;
    }
    this.favoriteBusy = true;
    this.http.post<FavoriteResponse>(`${environment.apiUrl}/auth/favorites/${id}/toggle`, {}).subscribe({
      next: response => {
        const user = this.auth.currentUser;
        if (user) this.auth.updateUser({ ...user, favorites: (response.favorites || []).map(String) });
        this.notify.show(response.favorite ? 'تمت إضافة الكتاب إلى المفضلة ✓' : 'تمت إزالة الكتاب من المفضلة ✓', 'success');
        this.favoriteBusy = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Favorite error:', err);
        this.notify.show('تعذر تحديث المفضلة. حاول مرة أخرى.', 'error');
        this.favoriteBusy = false;
        this.cdr.detectChanges();
      }
    });
  }

  download(): void {
    if (!this.bookId || this.downloadBusy) return;
    if (this.api.hasDownloadedBook(this.bookId)) {
      window.open(this.api.getDownloadUrl(this.bookId), '_blank', 'noopener,noreferrer');
      return;
    }

    this.downloadBusy = true;
    this.api.addDownload(this.bookId).subscribe({
      next: result => {
        this.api.markBookAsDownloaded(this.bookId);
        if (this.book) {
          this.book.downloads = result.downloads;
          this.cdr.detectChanges();
        }
        window.open(this.api.getDownloadUrl(this.bookId), '_blank', 'noopener,noreferrer');
        this.downloadBusy = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Download count error:', err);
        this.notify.show('تعذر بدء التحميل. حاول مرة أخرى.', 'error');
        this.downloadBusy = false;
        this.cdr.detectChanges();
      }
    });
  }
}
