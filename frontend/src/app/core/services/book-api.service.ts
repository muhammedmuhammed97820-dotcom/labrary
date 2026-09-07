import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

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

export interface BookPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BookListResponse {
  books: Book[];
  pagination: BookPagination;
}

export interface ImportedBookPreview {
  sourceId: string;
  source: string;
  sourceProvider: string;
  sourceUrl: string;
  sourceFileUrl: string;
  title: string;
  author: string;
  description: string;
  publishedYear?: number;
  language: string;
  rights: string;
  subjects: string[];
  coverUrl: string;
  pdfAvailable: boolean;
  openRights: boolean;
  importable: boolean;
  reason: string;
}

export interface ImportPreviewResponse {
  source: string;
  query: string;
  page: number;
  rows: number;
  total: number;
  books: ImportedBookPreview[];
  note: string;
}

export interface ImportApprovalResponse {
  message: string;
  imported: Array<{ id: string; sourceId: string; title: string }>;
  skipped: Array<{ sourceId: string; reason: string }>;
  totalRequested: number;
}

@Injectable({ providedIn: 'root' })
export class BookApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/books`;
  private readonly smartImporterApi = `${environment.apiUrl}/smart-importer`;
  private readonly apiOrigin = environment.apiOrigin.replace(/\/$/, '');
  private readonly viewerStorageKey = 'electronic_library_viewer_id';
  private readonly viewedBooksStorageKey = 'electronic_library_viewed_books';
  private readonly downloadedBooksStorageKey = 'electronic_library_downloaded_books';

  getAll(page = 1, limit = 24, search = ''): Observable<Book[]> {
    let params = new HttpParams().set('page', Math.max(page, 1)).set('limit', Math.max(limit, 1));
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<BookListResponse | Book[]>(this.api, { params }).pipe(
      map(response => Array.isArray(response) ? response : response.books)
    );
  }

  getAllPaginated(page = 1, limit = 24, search = ''): Observable<BookListResponse> {
    let params = new HttpParams().set('page', Math.max(page, 1)).set('limit', Math.min(Math.max(limit, 1), 100));
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<BookListResponse>(this.api, { params });
  }

  getAdminAll(): Observable<Book[]> { return this.http.get<Book[]>(`${this.api}/admin/all`); }
  getById(id: string): Observable<Book> { return this.http.get<Book>(`${this.api}/${id}`); }
  create(data: FormData): Observable<{ message: string; book: Book }> { return this.http.post<{ message: string; book: Book }>(this.api, data); }
  submitBook(data: FormData): Observable<{ message: string; book: Book }> { return this.http.post<{ message: string; book: Book }>(this.api, data); }
  mySubmissions(): Observable<Book[]> { return this.http.get<Book[]>(`${this.api}/my-submissions`); }
  adminSubmissions(): Observable<Book[]> { return this.http.get<Book[]>(`${this.api}/admin/pending`); }
  reviewSubmission(id: string, status: 'approved' | 'rejected', rejectionReason = ''): Observable<{ message: string; book: Book }> {
    return this.http.patch<{ message: string; book: Book }>(`${this.api}/admin/${id}/review`, { status, rejectionReason });
  }
  update(id: string, data: FormData): Observable<{ message: string; book: Book }> { return this.http.put<{ message: string; book: Book }>(`${this.api}/${id}`, data); }
  remove(id: string): Observable<{ message: string }> { return this.http.delete<{ message: string }>(`${this.api}/${id}`); }

  previewArabicBooks(page = 1, rows = 20, onlyImportable = true): Observable<ImportPreviewResponse> {
    return this.http.post<ImportPreviewResponse>(`${this.smartImporterApi}/preview`, { page, rows, onlyImportable });
  }

  approveArabicBooks(sourceIds: string[]): Observable<ImportApprovalResponse> {
    return this.http.post<ImportApprovalResponse>(`${this.smartImporterApi}/approve`, { sourceIds });
  }

  hasViewedBook(id: string): boolean { return this.hasStoredBookId(this.viewedBooksStorageKey, id); }
  markBookAsViewed(id: string): void { this.markStoredBookId(this.viewedBooksStorageKey, id); }
  hasDownloadedBook(id: string): boolean { return this.hasStoredBookId(this.downloadedBooksStorageKey, id); }
  markBookAsDownloaded(id: string): void { this.markStoredBookId(this.downloadedBooksStorageKey, id); }

  addView(id: string): Observable<{ viewsCount: number; counted: boolean }> {
    return this.http.post<{ viewsCount: number; counted: boolean }>(`${this.api}/${id}/views`, {}, { headers: this.viewerHeaders() });
  }

  addDownload(id: string): Observable<{ downloads: number; counted: boolean }> {
    return this.http.post<{ downloads: number; counted: boolean }>(`${this.api}/${id}/downloads`, {}, { headers: this.viewerHeaders() });
  }

  getFileUrl(filePath?: string | null): string {
    if (!filePath) return '';
    if (/^(data:|blob:|https?:\/\/)/i.test(filePath)) return filePath;
    return `${this.apiOrigin}/${filePath.replace(/^\/+/, '')}`;
  }

  getBookCoverUrl(book: Pick<Book, '_id' | 'coverImage'> | null | undefined): string {
    if (!book) return '';
    const cover = book.coverImage?.trim();
    if (!cover) return '';
    return this.getFileUrl(cover);
  }

  getAuthorImageUrl(image?: string | null): string { return this.getFileUrl(image); }
  getReaderUrl(id: string): string { return `${this.api}/${id}/read`; }
  getDownloadUrl(id: string): string { return `${this.api}/${id}/download`; }
  private viewerHeaders(): HttpHeaders { return new HttpHeaders({ 'X-Viewer-Id': this.getViewerId() }); }

  private hasStoredBookId(storageKey: string, id: string): boolean {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.includes(id);
    } catch { return false; }
  }

  private markStoredBookId(storageKey: string, id: string): void {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const stored: string[] = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      if (!stored.includes(id)) {
        stored.push(id);
        localStorage.setItem(storageKey, JSON.stringify(stored));
      }
    } catch {}
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
    } catch { return `temporary-${Date.now()}`; }
  }
}
