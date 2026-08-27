import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { Book, BookResponse } from '../models/book.model';

@Injectable({
  providedIn: 'root'
})
export class BookService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api/books';
  private readonly serverUrl = 'http://localhost:5000';

  getBooks(): Observable<Book[]> {
    return this.http.get<Book[] | { books?: Book[]; data?: Book[] }>(this.apiUrl).pipe(
      map((response) => {
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.books)) return response.books;
        if (response && Array.isArray(response.data)) return response.data;
        return [];
      })
    );
  }

  getBook(id: string): Observable<Book> {
    return this.http.get<Book>(`${this.apiUrl}/${id}`);
  }

  createBook(formData: FormData): Observable<BookResponse> {
    return this.http.post<BookResponse>(this.apiUrl, formData);
  }

  updateBook(id: string, formData: FormData): Observable<BookResponse> {
    return this.http.put<BookResponse>(`${this.apiUrl}/${id}`, formData);
  }

  deleteBook(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  incrementViews(id: string): Observable<{ viewsCount: number }> {
    return this.http.post<{ viewsCount: number }>(`${this.apiUrl}/${id}/views`, {});
  }

  incrementDownloads(id: string): Observable<{ downloads: number }> {
    return this.http.post<{ downloads: number }>(`${this.apiUrl}/${id}/downloads`, {});
  }

  getBookFileBlob(filePath: string): Observable<Blob> {
    const fileUrl = this.getFileUrl(filePath);
    return this.http.get(fileUrl, { responseType: 'blob' });
  }

  getCoverUrl(coverImage: string | null | undefined): string {
    if (!coverImage) return 'assets/images/default-book-cover.svg';
    if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) return coverImage;

    const fileName = coverImage.split(/[/\\]/).pop();
    return `${this.serverUrl}/uploads/covers/${fileName}`;
  }

  getFileUrl(filePath: string | null | undefined): string {
    if (!filePath) return '#';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;

    const fileName = filePath.split(/[/\\]/).pop();
    return `${this.serverUrl}/uploads/books/${fileName}`;
  }
}