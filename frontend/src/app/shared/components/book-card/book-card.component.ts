import {
  Component,
  Input,
  inject
} from '@angular/core';

import {
  RouterLink
} from '@angular/router';

import {
  Book
} from '../../../core/models/book.model';

import {
  BookService
} from '../../../core/services/book.service';

@Component({
  selector: 'app-book-card',
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl:
    './book-card.component.html',
  styleUrl:
    './book-card.component.scss'
})
export class BookCardComponent {

  @Input({
    required: true
  })
  book!: Book;

  readonly bookService =
    inject(BookService);

  getAuthorName(): string {

    if (
      typeof this.book.author ===
      'string'
    ) {
      return this.book.author;
    }

    return this.book.author?.name ??
      'مؤلف غير معروف';
  }

  getCategoryName(): string {

    if (
      typeof this.book.category ===
      'string'
    ) {
      return this.book.category;
    }

    return this.book.category?.name ??
      'عام';
  }
}
