import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookApiService, Book } from '../../../core/services/book-api.service';

@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-submissions.component.html',
  styleUrl: './my-submissions.component.scss'
})
export class MySubmissionsComponent {
  readonly api = inject(BookApiService);
  books: Book[] = [];
  loading = true;

  ngOnInit(): void {
    this.api.mySubmissions().subscribe({
      next: books => {
        this.books = books || [];
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  author(book: Book): string {
    return typeof book.author === 'string' ? book.author : book.author?.name || '—';
  }

  status(book: Book): string {
    return book.status === 'approved' ? 'تمت الموافقة' : book.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة';
  }
}
