import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface Book { _id?: string; id?: string|number; title?: string; description?: string; coverImage?: string; coverUrl?: string; author?: { name?: string } | string; category?: { name?: string } | string; views?: number; downloads?: number; }
interface FavoriteResponse { favorite: boolean; favorites: string[]; }

@Component({ selector: 'app-books', standalone: true, imports: [CommonModule, FormsModule, RouterLink], templateUrl: './books.component.html', styleUrl: './books.component.scss' })
export class BooksComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  books: Book[] = []; filtered: Book[] = []; search = ''; loading = true; error = ''; favoriteMessage = ''; favoriteBusy = new Set<string>();
  ngOnInit() { this.loadBooks(); }
  loadBooks() {
    this.loading = true; this.error = '';
    this.http.get<any>('http://localhost:5000/api/books').subscribe({
      next: r => {
        this.books = Array.isArray(r) ? r : (r.books ?? r.data ?? []);
        this.filtered = this.books;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Books load error:', err);
        this.error = err?.error?.message || 'تعذر الاتصال بالمكتبة الرقمية';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
  filter() { const q=this.search.trim().toLowerCase(); this.filtered=!q?this.books:this.books.filter(b=>`${b.title??''} ${this.author(b)} ${this.category(b)}`.toLowerCase().includes(q)); }
  id(b:Book){return String(b._id ?? b.id ?? '');}
  author(b:Book){return typeof b.author==='string'?b.author:b.author?.name??'مؤلف غير محدد';}
  category(b:Book){return typeof b.category==='string'?b.category:b.category?.name??'عام';}
  cover(b:Book): string {
    const value = b.coverImage || b.coverUrl;
    if (!value) return 'assets/images/default-cover.svg';
    if (/^https?:\/\//i.test(value)) return value;
    return `http://localhost:5000${value.startsWith('/') ? value : `/${value}`}`;
  }
  isFavorite(b: Book): boolean { const id = this.id(b); return !!id && (this.auth.currentUser?.favorites || []).some(f => String(f) === id); }
  toggleFavorite(book: Book): void {
    const id = this.id(book);
    if (!id) return;
    if (!this.auth.isLoggedIn) { this.favoriteMessage = 'سجّل الدخول أولًا لإضافة الكتب إلى المفضلة.'; return; }
    if (this.favoriteBusy.has(id)) return;
    this.favoriteBusy.add(id); this.favoriteMessage = '';
    this.http.post<FavoriteResponse>(`http://localhost:5000/api/auth/favorites/${id}/toggle`, {}).subscribe({
      next: r => { this.auth.updateUser({ ...this.auth.currentUser!, favorites: (r.favorites || []).map(String) }); this.favoriteMessage = r.favorite ? 'تمت إضافة الكتاب إلى المفضلة ✓' : 'تمت إزالة الكتاب من المفضلة ✓'; this.favoriteBusy.delete(id); this.cdr.detectChanges(); setTimeout(() => { if (this.favoriteMessage) { this.favoriteMessage = ''; this.cdr.detectChanges(); } }, 2500); },
      error: () => { this.favoriteMessage = 'تعذر تحديث المفضلة. حاول مرة أخرى.'; this.favoriteBusy.delete(id); this.cdr.detectChanges(); }
    });
  }
  isFavoriteBusy(b: Book): boolean { return this.favoriteBusy.has(this.id(b)); }
}
