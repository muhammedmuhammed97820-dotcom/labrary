import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

interface Category { 
  _id: string; 
  name: string; 
  description?: string; 
  booksCount?: number; 
}

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  public theme = inject(ThemeService);
  
  categories: Category[] = [];
  loading = true;
  error = '';
  
  // متغير لتخزين التصنيف المحدد لعرض تفاصيله الكاملة في النافذة المنبثقة
  selectedCategory: Category | null = null;

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.error = '';
    
    this.http.get<Category[]>('http://localhost:5000/api/categories').subscribe({
      next: (v) => { 
        this.categories = v || []; 
        this.loading = false; 
        this.cdr.detectChanges(); 
      },
      error: (err) => { 
        console.error('Error loading categories:', err);
        this.error = 'تعذر تحميل التصنيفات.'; 
        this.loading = false; 
        this.cdr.detectChanges(); 
      }
    });
  }

  openDescriptionModal(category: Category): void {
    this.selectedCategory = category;
    this.cdr.detectChanges();
  }

  closeDescriptionModal(): void {
    this.selectedCategory = null;
    this.cdr.detectChanges();
  }
}