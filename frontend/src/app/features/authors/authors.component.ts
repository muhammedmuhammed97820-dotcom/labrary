import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

interface Author { 
  _id: string; 
  name: string; 
  bio?: string; 
  image?: string; 
  nationality?: string; 
  booksCount?: number; 
}

@Component({
  selector: 'app-authors',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './authors.component.html',
  styleUrl: './authors.component.scss'
})
export class AuthorsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef); // حقن أداة كشف التغييرات
  public theme = inject(ThemeService);
  
  authors: Author[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadAuthors();
  }

  loadAuthors(): void {
    this.loading = true;
    this.error = '';
    
    this.http.get<Author[]>('http://localhost:5000/api/authors').subscribe({
      next: (data) => { 
        this.authors = data || []; 
        this.loading = false; 
        this.cdr.detectChanges(); // تحديث الواجهة فورياً عند استلام البيانات
      },
      error: (err) => { 
        console.error('Error loading authors:', err);
        this.error = 'تعذر تحميل المؤلفين.'; 
        this.loading = false; 
        this.cdr.detectChanges(); // تحديث الواجهة حتى عند حدوث خطأ
      }
    });
  }

  imageUrl(v: string): string {
    if (!v) return '';
    return /^https?:\/\//i.test(v) ? v : `http://localhost:5000${v.startsWith('/') ? v : `/${v}`}`;
  }

  initial(n: string): string {
    return n?.trim()?.charAt(0) || 'م';
  }
}