import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Book {
  _id?: string;
  title: string;
  author: { _id?: string; name: string } | string | null;
  category: { _id?: string; name: string } | string | null;
  submittedAuthorName?: string;
  submittedCategoryName?: string;
  description?: string;
  publishedYear?: number;
  rating?: number;
  viewsCount?: number;
  downloads?: number;
  isAvailable?: boolean;
  filePath?: string;
  coverImage?: string;
  status?: 'pending' | 'approved' | 'rejected';
  submittedBy?: any;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class BookApiService {
  private readonly http = inject(HttpClient);
  private readonly api = 'http://localhost:5000/api/books';
  private readonly viewerStorageKey = 'electronic_library_viewer_id';
  private readonly viewedBooksStorageKey = 'electronic_library_viewed_books';

  getAll(page = 1, limit = 24, search = ''): Observable<Book[]> {
    let params = new HttpParams();
    if (page > 1) params = params.set('page', page);
    if (limit > 0) params = params.set('limit', limit);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<Book[]>(this.api, { params });
  }

  getAdminAll(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.api}/admin/all`);
  }

  getById(id: string): Observable<Book> {
    return this.http.get<Book>(`${this.api}/${id}`);
  }

  create(data: FormData): Observable<{ message: string; book: Book }> {
    return this.http.post<{ message: string; book: Book }>(this.api, data);
  }

  submitBook(data: FormData): Observable<{ message: string; book: Book }> {
    return this.http.post<{ message: string; book: Book }>(this.api, data);
  }

  mySubmissions(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.api}/my-submissions`);
  }

  adminSubmissions(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.api}/admin/pending`);
  }

  reviewSubmission(id: string, status: 'approved' | 'rejected', rejectionReason = ''): Observable<{ message: string; book: Book }> {
    return this.http.patch<{ message: string; book: Book }>(`${this.api}/admin/${id}/review`, {
      status,
      rejectionReason
    });
  }

  update(id: string, data: FormData): Observable<{ message: string; book: Book }> {
    return this.http.put<{ message: string; book: Book }>(`${this.api}/${id}`, data);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  hasViewedBook(id: string): boolean {
    try {
      const raw = localStorage.getItem(this.viewedBooksStorageKey);
      if (!raw) return false;
      const viewed: unknown = JSON.parse(raw);
      return Array.isArray(viewed) && viewed.includes(id);
    } catch {
      return false;
    }
  }

  markBookAsViewed(id: string): void {
    try {
      const raw = localStorage.getItem(this.viewedBooksStorageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const viewed: string[] = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      if (!viewed.includes(id)) {
        viewed.push(id);
        localStorage.setItem(this.viewedBooksStorageKey, JSON.stringify(viewed));
      }
    } catch {
      // Backend remains the source of truth if localStorage is unavailable.
    }
  }

  addView(id: string): Observable<{ viewsCount: number; counted: boolean }> {
    const viewerId = this.getViewerId();
    const headers = new HttpHeaders({ 'X-Viewer-Id': viewerId });
    return this.http.post<{ viewsCount: number; counted: boolean }>(`${this.api}/${id}/views`, {}, { headers });
  }

  private getViewerId(): string {
    try {
      const existing = localStorage.getItem(this.viewerStorageKey);
      if (existing) return existing;
      const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(this.viewerStorageKey, generated);
      return generated;
    } catch {
      return `temporary-${Date.now()}`;
    }
  }

  getFileUrl(filePath: string): string {
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `http://localhost:5000${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
  }

  getReaderUrl(id: string): string {
    return `${this.api}/${id}/read`;
  }

  getDownloadUrl(id: string): string {
    return `${this.api}/${id}/download`;
  }
}
