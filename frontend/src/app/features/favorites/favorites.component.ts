import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface Book { _id?: string; id?: string|number; title?: string; coverImage?: string; coverUrl?: string; author?: { name?: string } | string; }

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss'
})
export class FavoritesComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  books: Book[] = [];
  loading = true;
  error = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    const ids = this.auth.currentUser?.favorites || [];
    if (!ids.length) { this.books = []; this.loading = false; return; }
    this.http.get<any>('http://localhost:5000/api/books').subscribe({
      next: r => {
        const all: Book[] = Array.isArray(r) ? r : (r.books ?? r.data ?? []);
        this.books = all.filter(b => ids.includes(String(b._id ?? b.id)));
        this.loading = false;
      },
      error: () => { this.error = 'تعذر تحميل المفضلة.'; this.loading = false; }
    });
  }

  id(book: Book): string { return String(book._id ?? book.id ?? ''); }
  author(book: Book): string { return typeof book.author === 'string' ? book.author : book.author?.name || 'مؤلف غير محدد'; }
  cover(book: Book): string { return book.coverImage || book.coverUrl || 'assets/images/default-cover.svg'; }

  remove(book: Book): void {
    this.http.post<{favorite:boolean;favorites:string[]}>(`http://localhost:5000/api/auth/favorites/${this.id(book)}/toggle`, {}).subscribe({
      next: r => { this.auth.updateUser({ ...this.auth.currentUser!, favorites: r.favorites }); this.books = this.books.filter(b => this.id(b) !== this.id(book)); },
      error: () => this.error = 'تعذر إزالة الكتاب من المفضلة.'
    });
  }
}
