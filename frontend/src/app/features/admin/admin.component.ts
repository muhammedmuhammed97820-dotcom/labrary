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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getAll().subscribe({
      next: b => {
        this.books = b;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: e => {
        console.error('Admin books load error:', e);
        this.error = e?.error?.message || 'تعذر تحميل إحصائيات المكتبة.';
        this.loading = false;
        this.cdr.detectChanges();
      }
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
  get available(): number { return this.books.filter(b => b.isAvailable !== false).length; }
  get views(): number { return this.books.reduce((n, b) => n + (Number(b.viewsCount) || 0), 0); }
  get downloads(): number { return this.books.reduce((n, b) => n + (Number(b.downloads) || 0), 0); }
  get authors(): number { return new Set(this.books.map(b => typeof b.author === 'string' ? b.author : b.author?.name).filter(Boolean)).size; }
  get categories(): number { return new Set(this.books.map(b => typeof b.category === 'string' ? b.category : b.category?.name).filter(Boolean)).size; }
  get recent(): Book[] { return [...this.books].slice(-5).reverse(); }
}