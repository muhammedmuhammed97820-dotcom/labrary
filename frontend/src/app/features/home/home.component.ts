import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { BookApiService } from '../../core/services/book-api.service';

interface Book {
  _id?: string;
  id?: string | number;
  title?: string;
  description?: string;
  coverImage?: string;
  coverUrl?: string;
  cover?: string;
  image?: string;
  author?: { name?: string; _id?: string } | string;
  category?: { name?: string; _id?: string } | string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  public readonly themeService = inject(ThemeService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private readonly media = inject(BookApiService);

  realBooks: Book[] = [];
  loadingBooks = true;

  ngOnInit(): void {
    this.fetchRealBooks();
  }

  fetchRealBooks(): void {
    this.loadingBooks = true;
    this.http.get<any>(this.media.getFileUrl('/api/books')).subscribe({
      next: (r) => {
        const booksList = Array.isArray(r) ? r : (r.books ?? r.data ?? []);
        this.realBooks = booksList.slice(0, 5);
        this.loadingBooks = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching books for home:', err);
        this.loadingBooks = false;
        this.cdr.detectChanges();
      }
    });
  }

  getBookId(book: any): string {
    return String(book?._id ?? book?.id ?? '');
  }

  getAuthorName(book: Book): string {
    if (!book.author) return 'مكتبة الحكمة';
    return typeof book.author === 'string' ? book.author : book.author?.name || 'مؤلف غير معروف';
  }

  getBookCover(book: Book): string | null {
    const cover = book?.coverImage || book?.coverUrl || book?.cover || book?.image;
    if (!cover) return null;
    return this.media.getFileUrl(cover);
  }
}
