import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { BookApiService } from '../../core/services/book-api.service';

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
  private cdr = inject(ChangeDetectorRef);
  private readonly media = inject(BookApiService);
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

    this.http.get<Author[]>(`${this.media.getFileUrl('/api')}/authors`).subscribe({
      next: (data) => {
        this.authors = data || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading authors:', err);
        this.error = 'تعذر تحميل المؤلفين.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  imageUrl(v?: string | null): string {
    return this.media.getAuthorImageUrl(v);
  }

  initial(n: string): string {
    return n?.trim()?.charAt(0) || 'م';
  }
}
