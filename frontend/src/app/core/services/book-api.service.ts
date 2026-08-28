import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Book {
  _id?: string;
  title: string;
  author: { _id?: string; name: string } | string;
  category: { _id?: string; name: string } | string;
  description?: string;
  publishedYear?: number;
  rating?: number;
  viewsCount?: number;
  downloads?: number;
  isAvailable?: boolean;
  filePath?: string;
  coverImage?: string;
}

@Injectable({ providedIn: 'root' })
export class BookApiService {
  private readonly http = inject(HttpClient);
  private readonly api = 'http://localhost:5000/api/books';

  getAll(page = 1, limit = 24, search = ''): Observable<Book[]> {
    let params = new HttpParams();
    if (page > 1) params = params.set('page', page);
    if (limit > 0) params = params.set('limit', limit);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<Book[]>(this.api, { params });
  }

  getById(id: string): Observable<Book> {
    return this.http.get<Book>(`${this.api}/${id}`);
  }

  create(data: FormData): Observable<{ message: string; book: Book }> {
    return this.http.post<{ message: string; book: Book }>(this.api, data);
  }

  update(id: string, data: FormData): Observable<{ message: string; book: Book }> {
    return this.http.put<{ message: string; book: Book }>(`${this.api}/${id}`, data);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  addView(id: string): Observable<{ viewsCount?: number; views?: number }> {
    return this.http.post<{ viewsCount?: number; views?: number }>(`${this.api}/${id}/views`, {});
  }

  getFileUrl(filePath: string): string {
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `http://localhost:5000${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
  }

  getReaderUrl(id: string): string { return `${this.api}/${id}/read`; }
  getDownloadUrl(id: string): string { return `${this.api}/${id}/download`; }
}
