import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { BookService } from '../../../../core/services/book.service';
import { Book } from '../../../../core/models/book.model';

@Component({
  selector: 'app-admin-book-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-book-list.component.html',
  styleUrl: './admin-book-list.component.css'
})
export class AdminBookListComponent implements OnInit {

  readonly bookService = inject(BookService);
  readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  books: Book[] = [];

  loading = false;
  error = '';

  ngOnInit(): void {
    this.loadBooks();
  }

  // ==========================================================
  // LOAD BOOKS
  // ==========================================================

  loadBooks(): void {

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.error = '';

    console.log('[Electronic Library] Loading books...');

    this.bookService
      .getBooks()
      .pipe(
        timeout(15000),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges(); // ضمان إخفاء مؤشر التحميل في الواجهة
          console.log('[Electronic Library] Loading finished.');
        })
      )
      .subscribe({

        next: (response: any) => {

          console.log('[Electronic Library] Books received:', response);

          // استخراج المصفوفة بغض النظر عن طريقة إرجاعها من السيرفر
          if (Array.isArray(response)) {
            this.books = response;
          } else if (response && Array.isArray(response.books)) {
            this.books = response.books;
          } else if (response && Array.isArray(response.data)) {
            this.books = response.data;
          } else {
            this.books = [];
          }

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error('[Electronic Library] Books loading error:', error);

          this.books = [];

          if (error?.name === 'TimeoutError') {
            this.error = 'الخادم لم يستجب خلال الوقت المحدد. تأكد أن الـ Backend يعمل على المنفذ 5000.';
          } else {
            this.error = 'تعذر تحميل الكتب من الخادم.';
          }

          this.cdr.detectChanges();
        }
      });
  }

  // ==========================================================
  // COVER
  // ==========================================================

  getCover(book: Book): string {
    return this.bookService.getCoverUrl(book.coverImage);
  }

  // ==========================================================
  // FILE
  // ==========================================================

  getFile(book: Book): string {
    return this.bookService.getFileUrl(book.filePath);
  }

  // ==========================================================
  // CREATE
  // ==========================================================

  addBook(): void {
    this.router.navigate(['/admin/books/create']);
  }

  // ==========================================================
  // OPEN
  // ==========================================================

  openBook(book: Book): void {
    if (!book._id) {
      return;
    }
    this.router.navigate(['/books', book._id]);
  }

  // ==========================================================
  // DELETE
  // ==========================================================

  deleteBook(book: Book): void {

    if (!book._id) {
      return;
    }

    const confirmed = window.confirm(`هل تريد حذف الكتاب "${book.title}"؟`);

    if (!confirmed) {
      return;
    }

    this.bookService
      .deleteBook(book._id)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({

        next: () => {
          this.books = this.books.filter(item => item._id !== book._id);
          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error('[Electronic Library] Delete error:', error);
          alert('حدث خطأ أثناء حذف الكتاب.');
        }
      });
  }

  // ==========================================================
  // DATE
  // ==========================================================

  formatDate(value: string | Date | undefined): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}