import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ImportExtraction {
  score: number;
  confidence: number;
  signals: string[];
}

export interface ImportCandidate {
  title: string;
  author: string;
  category: string;
  description: string;
  pages: string;
  isbn: string;
  publishedYear: string;
  language: string;
  coverImage: string;
  sourceUrl: string;
  sourceFileUrl: string;
  source: string;
  sourceId: string;
  rights: string;
  extraction?: ImportExtraction;
  authorBio?: string;
  authorImage?: string;
  duplicate?: boolean;
  duplicateBookId?: string | null;
  ai?: { enabled: boolean; confidence: number; notes: string };
  selected?: boolean;
}

export interface ImportPreviewResponse {
  message: string;
  sourceUrl: string;
  scannedPages: number;
  discovered: number;
  books: ImportCandidate[];
}

@Injectable({ providedIn: 'root' })
export class SmartImporterService {
  private readonly http = inject(HttpClient);
  private readonly api = 'http://localhost:5000/api/admin/smart-importer';

  preview(url: string, maxPages = 20, maxBooks = 50): Observable<ImportPreviewResponse> {
    return this.http.post<ImportPreviewResponse>(`${this.api}/preview`, { url, maxPages, maxBooks });
  }

  approve(books: ImportCandidate[], downloadPdf = false): Observable<any> {
    return this.http.post(`${this.api}/approve`, { books, downloadPdf });
  }
}
