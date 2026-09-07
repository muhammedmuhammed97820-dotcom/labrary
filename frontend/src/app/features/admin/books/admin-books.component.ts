import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../../core/services/book-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-admin-books',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './admin-books.component.html',
  styleUrl: './admin-books.component.scss'
})
export class AdminBooksComponent implements OnInit {
  private readonly booksApi = inject(BookApiService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly themeService = inject(ThemeService);

  books: Book[] = [];
  query = '';
  loading = true;
  error = '';
  deletingId = '';

  showDeleteModal = false;
  bookToDelete: Book | null = null;

  ngOnInit(): void {
    this.load(false);
  }

  get filteredBooks(): Book[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.books;
    return this.books.filter(book => {
      const author = typeof book.author === 'string' ? book.author : book.author?.name;
      const category = typeof book.category === 'string' ? book.category : book.category?.name;
      return [book.title, author, category, book.description].some(v => String(v ?? '').toLowerCase().includes(q));
    });
  }

  load(showNotify = true): void {
    this.loading = true;
    this.error = '';
    this.booksApi.getAll().subscribe({
      next: books => {
        this.books = books || [];
        this.loading = false;
        if (showNotify) this.notify.show('تم تحديث قائمة الكتب بنجاح.', 'info');
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Admin books load error:', err);
        this.error = err?.error?.message || 'تعذر تحميل قائمة الكتب.';
        this.loading = false;
        this.notify.show(this.error, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  openDeleteModal(book: Book, event: Event): void {
    event.stopPropagation();
    this.bookToDelete = book;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    if (this.deletingId) return;
    this.showDeleteModal = false;
    this.bookToDelete = null;
  }

  executeDelete(): void {
    if (!this.bookToDelete) return;
    const book = this.bookToDelete;
    const bookId = this.getBookId(book);
    if (!bookId) return;

    this.deletingId = bookId;
    this.cdr.detectChanges();
    this.booksApi.remove(bookId).subscribe({
      next: () => {
        this.books = this.books.filter(item => this.getBookId(item) !== bookId);
        this.deletingId = '';
        this.closeDeleteModal();
        this.notify.show(`تم حذف كتاب «${book.title}» بنجاح.`, 'success');
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Delete error:', err);
        const msg = err?.error?.message || 'فشلت عملية حذف الكتاب.';
        this.notify.show(msg, 'error');
        this.deletingId = '';
        this.closeDeleteModal();
        this.cdr.detectChanges();
      }
    });
  }

  getBookId(book: any): string {
    return book?._id || book?.id || '';
  }

  getBookCover(book: Book): string {
    const cover = book?.coverImage;
    return cover ? this.booksApi.getBookCoverUrl(book) : '';
  }

  authorName(book: Book): string {
    return typeof book.author === 'string' ? book.author : book.author?.name || '—';
  }

  categoryName(book: Book): string {
    return typeof book.category === 'string' ? book.category : book.category?.name || '—';
  }
}
