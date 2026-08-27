import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../../core/services/book-api.service';

@Component({
  selector: 'app-admin-books',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-books.component.html',
  styleUrl: './admin-books.component.scss'
})
export class AdminBooksComponent implements OnInit {
  private readonly booksApi = inject(BookApiService);
  books: Book[] = [];
  query = '';
  loading = true;
  error = '';
  deletingId = '';

  ngOnInit(): void { this.load(); }

  get filteredBooks(): Book[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.books;
    return this.books.filter(book => {
      const author = typeof book.author === 'string' ? book.author : book.author?.name;
      const category = typeof book.category === 'string' ? book.category : book.category?.name;
      return [book.title, author, category, book.description].some(v => String(v ?? '').toLowerCase().includes(q));
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.booksApi.getAll().subscribe({
      next: books => { this.books = books; this.loading = false; },
      error: err => { this.error = err?.error?.message || 'تعذر تحميل الكتب.'; this.loading = false; }
    });
  }

  confirmDelete(book: Book): void {
    if (!book._id || this.deletingId) return;
    if (!confirm(`هل تريد حذف «${book.title}» نهائيًا؟`)) return;
    this.deletingId = book._id;
    this.booksApi.remove(book._id).subscribe({
      next: () => { this.books = this.books.filter(item => item._id !== book._id); this.deletingId = ''; },
      error: err => { this.error = err?.error?.message || 'فشل حذف الكتاب.'; this.deletingId = ''; }
    });
  }

  authorName(book: Book): string { return typeof book.author === 'string' ? book.author : book.author?.name || '—'; }
  categoryName(book: Book): string { return typeof book.category === 'string' ? book.category : book.category?.name || '—'; }
}
