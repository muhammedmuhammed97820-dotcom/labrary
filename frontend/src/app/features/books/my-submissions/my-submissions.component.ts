import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookApiService, Book } from '../../../core/services/book-api.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-submissions.component.html',
  styleUrl: './my-submissions.component.scss'
})
export class MySubmissionsComponent implements OnInit {
  readonly api = inject(BookApiService);
  public readonly themeService = inject(ThemeService);
  books: Book[] = [];
  loading = true;

  ngOnInit(): void {
    this.api.mySubmissions().subscribe({
      next: (res: any) => {
        console.log('API Response:', res); // سيظهر لك شكل البيانات في المتصفح F12
        // التعامل مع مختلف أشكال الاستجابة (مصفوفة مباشرة أو مغلفة في كائن)
        this.books = Array.isArray(res) ? res : (res?.data || res?.books || []);
        this.loading = false;
      },
      error: (err) => {
        console.error('API Error:', err); // سيوضح أي خطأ صامت من الخادم
        this.loading = false;
      }
    });
  }

  author(book: Book): string {
    return typeof book.author === 'string' ? book.author : book.author?.name || '—';
  }

  status(book: Book): string {
    return book.status === 'approved' ? 'تمت الموافقة' : book.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة';
  }
}