import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../core/services/book-api.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private readonly api = inject(BookApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly themeService = inject(ThemeService);
  private readonly serverOrigin = 'http://localhost:5000';

  books: Book[] = [];
  loading = true;
  error = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getAdminAll().subscribe({
      next: books => { this.books = books; this.loading = false; this.cdr.detectChanges(); },
      error: error => { console.error('Admin books load error:', error); this.error = error?.error?.message || 'تعذر تحميل إحصائيات المكتبة.'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  getBookCover(book: any): string | null {
    const cover = book?.coverImage || book?.coverUrl || book?.cover;
    if (!cover) return null;
    if (/^data:|^blob:|^https?:\/\//i.test(cover)) return cover;
    return `${this.serverOrigin}${cover.startsWith('/') ? cover : `/${cover}`}`;
  }

  getAuthorName(author: any): string {
    if (!author) return 'مؤلف غير معروف';
    return typeof author === 'string' ? author : author.name || 'مؤلف غير معروف';
  }

  get total(): number { return this.books.length; }
  get available(): number { return this.books.filter(book => book.isAvailable !== false && book.status !== 'rejected').length; }
  get pending(): number { return this.books.filter(book => book.status === 'pending').length; }
  get views(): number { return this.books.reduce((total, book) => total + (Number(book.viewsCount) || 0), 0); }
  get downloads(): number { return this.books.reduce((total, book) => total + (Number(book.downloads) || 0), 0); }
  get authors(): number { return new Set(this.books.map(book => typeof book.author === 'string' ? book.author : book.author?.name).filter(Boolean)).size; }
  get categories(): number { return new Set(this.books.map(book => typeof book.category === 'string' ? book.category : book.category?.name).filter(Boolean)).size; }

  get recent(): Book[] {
    return [...this.books].sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)).slice(0, 5);
  }

  get topViewed(): Book[] {
    return [...this.books].filter(book => book.status === 'approved').sort((a, b) => (Number(b.viewsCount) || 0) - (Number(a.viewsCount) || 0)).slice(0, 5);
  }
}
