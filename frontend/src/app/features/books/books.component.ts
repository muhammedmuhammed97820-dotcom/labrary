import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface Book { _id?: string; id?: string|number; title?: string; description?: string; coverImage?: string; coverUrl?: string; author?: { name?: string } | string; category?: { name?: string } | string; views?: number; downloads?: number; }

@Component({ selector: 'app-books', standalone: true, imports: [CommonModule, FormsModule, RouterLink], templateUrl: './books.component.html', styleUrl: './books.component.scss' })
export class BooksComponent {
  private http = inject(HttpClient);
  books: Book[] = []; filtered: Book[] = []; search = ''; loading = true; error = '';
  ngOnInit() { this.loadBooks(); }
  loadBooks() { this.loading = true; this.http.get<any>('http://localhost:5000/api/books').subscribe({ next: r => { this.books = Array.isArray(r) ? r : (r.books ?? r.data ?? []); this.filtered = this.books; this.loading = false; }, error: () => { this.error = 'تعذر الاتصال بالمكتبة الرقمية'; this.loading = false; } }); }
  filter() { const q=this.search.trim().toLowerCase(); this.filtered=!q?this.books:this.books.filter(b=>`${b.title??''} ${this.author(b)} ${this.category(b)}`.toLowerCase().includes(q)); }
  id(b:Book){return b._id ?? String(b.id ?? '');} author(b:Book){return typeof b.author==='string'?b.author:b.author?.name??'مؤلف غير محدد';} category(b:Book){return typeof b.category==='string'?b.category:b.category?.name??'عام';} cover(b:Book){return b.coverImage||b.coverUrl||'assets/images/default-cover.svg';}
}
