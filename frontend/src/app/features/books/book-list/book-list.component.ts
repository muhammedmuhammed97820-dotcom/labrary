import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  RouterLink
} from '@angular/router';

import {
  BookService
} from '../../../core/services/book.service';

import {
  Book
} from '../../../core/models/book.model';

@Component({
  selector: 'app-book-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './book-list.component.html',
  styleUrl: './book-list.component.css'
})
export class BookListComponent implements OnInit {

  readonly bookService = inject(BookService);

  books: Book[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadBooks();
  }

  // ==========================================================
  // LOAD BOOKS
  // ==========================================================

  loadBooks(): void {

    this.loading = true;
    this.error = '';

    this.bookService.getBooks().subscribe({

      next: (response: any) => {

        let booksData: any[] = [];

        if (Array.isArray(response)) {
          booksData = response;
        } else if (response && Array.isArray(response.books)) {
          booksData = response.books;
        } else if (response && Array.isArray(response.data)) {
          booksData = response.data;
        }

        this.books = booksData;
        this.loading = false;
      },

      error: (error: any) => {

        console.error(
          '[Electronic Library] Books API Error:',
          error
        );

        this.books = [];

        this.error =
          error?.error?.message ||
          'تعذر تحميل الكتب من الخادم';

        this.loading = false;
      }

    });
  }

  // ==========================================================
  // AUTHOR NAME
  // ==========================================================

  getAuthorName(book: any): string {

    try {
      if (!book || !book.author) return 'غير معروف';

      if (typeof book.author === 'string') {
        return book.author;
      }

      return book.author?.name || 'غير معروف';
    } catch (e) {
      return 'غير معروف';
    }
  }

  // ==========================================================
  // CATEGORY NAME
  // ==========================================================

  getCategoryName(book: any): string {

    try {
      if (!book || !book.category) return 'عام';

      if (typeof book.category === 'string') {
        return book.category;
      }

      return book.category?.name || 'عام';
    } catch (e) {
      return 'عام';
    }
  }

  // ==========================================================
  // COVER URL
  // ==========================================================

  getCoverUrl(book: any): string {

    try {
      if (!book) return 'assets/images/default-book-cover.svg';

      const coverImage = typeof book === 'string' ? book : book.coverImage;

      return this.bookService.getCoverUrl(coverImage);
    } catch (e) {
      return 'assets/images/default-book-cover.svg';
    }
  }

  // ==========================================================
  // RETRY
  // ==========================================================

  retry(): void {
    this.loadBooks();
  }
}