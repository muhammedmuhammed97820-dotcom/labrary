import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CommunityUser { _id: string; name: string; email?: string; avatar?: string; }
export interface Quote { _id: string; text: string; page?: number | null; reportCount: number; status: string; user: CommunityUser; book: { _id: string; title: string }; createdAt: string; }
export interface CommunityComment { _id: string; book: string | { _id: string; title: string }; quote?: string | { _id: string; text: string } | null; parent?: string | null; text: string; reportCount: number; status: string; user: CommunityUser; createdAt: string; }
export interface ModerationReport { _id: string; reason: string; note: string; reporter: CommunityUser; createdAt: string; }
export interface ModerationItem { type: 'quote' | 'comment'; item: Quote | CommunityComment; reports: ModerationReport[]; }
export interface ReviewResponse { message: string; }

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/community`;

  quotes(book: string): Observable<Quote[]> { return this.http.get<Quote[]>(`${this.api}/quotes`, { params: { book } }); }
  comments(book: string): Observable<CommunityComment[]> { return this.http.get<CommunityComment[]>(`${this.api}/comments`, { params: { book } }); }
  addQuote(data: { book: string; text: string; page?: number | null }): Observable<Quote> { return this.http.post<Quote>(`${this.api}/quotes`, data); }
  addComment(data: { book: string; quote?: string | null; parent?: string | null; text: string }): Observable<CommunityComment> { return this.http.post<CommunityComment>(`${this.api}/comments`, data); }
  report(type: 'quote' | 'comment', id: string, reason: string, note = '') { return this.http.post<{ message: string; reportCount: number; flagged: boolean }>(`${this.api}/reports`, { type, id, reason, note }); }
  adminReports(): Observable<{ items: ModerationItem[]; total: number; threshold: number }> { return this.http.get<{ items: ModerationItem[]; total: number; threshold: number }>(`${this.api}/admin/reports`); }
  review(type: 'quote' | 'comment', id: string, action: 'restore' | 'reject', reason = ''): Observable<ReviewResponse> { return this.http.patch<ReviewResponse>(`${this.api}/admin/reports/${type}/${id}`, { action, reason }); }
}
