import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface Book { _id?: string; id?: string|number; title?: string; coverImage?: string; coverUrl?: string; author?: { name?: string } | string; }
interface FavoriteResponse { favorite: boolean; favorites: string[]; }

@Component({ selector: 'app-favorites', standalone: true, imports: [CommonModule, RouterLink], templateUrl: './favorites.component.html', styleUrl: './favorites.component.scss' })
export class FavoritesComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  books: Book[] = []; loading = true; error = ''; message = ''; removing = new Set<string>();

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    const ids = (this.auth.currentUser?.favorites || []).map(String);
    if (!ids.length) { this.books = []; this.loading = false; this.cdr.detectChanges(); return; }
    this.http.get<any>('http://localhost:5000/api/books').subscribe({
      next: r => {
        const all: Book[] = Array.isArray(r) ? r : (r.books ?? r.data ?? []);
        this.books = all.filter(b => ids.includes(this.id(b)));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => { console.error('Favorites load error:', err); this.error = err?.error?.message || 'تعذر تحميل المفضلة.'; this.loading = false; this.cdr.detectChanges(); }
    });
  }
  id(book: Book): string { return String(book._id ?? book.id ?? ''); }
  author(book: Book): string { return typeof book.author === 'string' ? book.author : book.author?.name || 'مؤلف غير محدد'; }
  cover(book: Book): string { return book.coverImage || book.coverUrl || 'assets/images/default-cover.svg'; }
  remove(book: Book): void {
    const id = this.id(book); if (!id || this.removing.has(id)) return;
    this.removing.add(id); this.message = '';
    this.http.post<FavoriteResponse>(`http://localhost:5000/api/auth/favorites/${id}/toggle`, {}).subscribe({
      next: r => { this.auth.updateUser({ ...this.auth.currentUser!, favorites: (r.favorites || []).map(String) }); this.books = this.books.filter(b => this.id(b) !== id); this.message = 'تمت إزالة الكتاب من المفضلة ✓'; this.removing.delete(id); this.cdr.detectChanges(); setTimeout(() => { if (this.message) { this.message = ''; this.cdr.detectChanges(); } }, 2500); },
      error: () => { this.error = 'تعذر إزالة الكتاب من المفضلة. حاول مرة أخرى.'; this.removing.delete(id); this.cdr.detectChanges(); }
    });
  }
}
