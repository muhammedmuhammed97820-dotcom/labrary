import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

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
  private readonly serverOrigin = 'http://localhost:5000';

  realBooks: Book[] = [];
  loadingBooks = true;

  ngOnInit(): void {
    this.fetchRealBooks();
  }

  fetchRealBooks(): void {
    this.http.get<any>(`${this.serverOrigin}/api/books`).subscribe({
      next: (r) => {
        // التعامل مع مختلف أشكال استجابة السيرفر (سواء مصفوفة مباشرة أو كائن يحتوي على books/data)
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

  // دالة موحدة لجلب الغلاف بنفس دقة مكون الكتب (تدعم coverImage, coverUrl, cover, image)
  getBookCover(book: any): string | null {
    const cover = book?.coverImage || book?.coverUrl || book?.cover || book?.image;
    if (!cover) return null;
    if (/^data:|^blob:|^https?:\/\//i.test(cover)) return cover;
    return `${this.serverOrigin}${cover.startsWith('/') ? cover : `/${cover}`}`;
  }
}