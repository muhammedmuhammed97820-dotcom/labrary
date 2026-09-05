import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Book {
  _id?: string; title: string; author: { _id?: string; name: string } | string; category: { _id?: string; name: string } | string;
  description?: string; publishedYear?: number; rating?: number; viewsCount?: number; downloads?: number; isAvailable?: boolean;
  filePath?: string; coverImage?: string; status?: 'pending'|'approved'|'rejected'; submittedBy?: any; rejectionReason?: string; reviewedAt?: string;
}
@Injectable({ providedIn: 'root' })
export class BookApiService {
  private readonly http=inject(HttpClient); private readonly api='http://localhost:5000/api/books'; private readonly viewerStorageKey='electronic_library_viewer_id';
  getAll(page=1,limit=24,search=''):Observable<Book[]>{let params=new HttpParams();if(page>1)params=params.set('page',page);if(limit>0)params=params.set('limit',limit);if(search.trim())params=params.set('search',search.trim());return this.http.get<Book[]>(this.api,{params});}
  getById(id:string):Observable<Book>{return this.http.get<Book>(`${this.api}/${id}`);}
  create(data:FormData):Observable<{message:string;book:Book}>{return this.http.post<{message:string;book:Book}>(this.api,data);}
  submitBook(data:FormData):Observable<{message:string;book:Book}>{return this.http.post<{message:string;book:Book}>(`${this.api}/submit`,data);}
  mySubmissions():Observable<Book[]>{return this.http.get<Book[]>(`${this.api}/my-submissions`);}
  adminSubmissions():Observable<Book[]>{return this.http.get<Book[]>(`${this.api}/admin/pending`);}
  reviewSubmission(id:string,status:'approved'|'rejected',rejectionReason=''):Observable<{message:string;book:Book}>{return this.http.patch<{message:string;book:Book}>(`${this.api}/admin/${id}/review`,{status,rejectionReason});}
  update(id:string,data:FormData):Observable<{message:string;book:Book}>{return this.http.put<{message:string;book:Book}>(`${this.api}/${id}`,data);}
  remove(id:string):Observable<{message:string}>{return this.http.delete<{message:string}>(`${this.api}/${id}`);}
  addView(id:string):Observable<{viewsCount:number;counted:boolean}>{const viewerId=this.getViewerId();const headers=new HttpHeaders({'X-Viewer-Id':viewerId});return this.http.post<{viewsCount:number;counted:boolean}>(`${this.api}/${id}/views`,{},{headers});}
  private getViewerId():string{try{const e=localStorage.getItem(this.viewerStorageKey);if(e)return e;const g=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random()}`;localStorage.setItem(this.viewerStorageKey,g);return g;}catch{return `temporary-${Date.now()}`;}}
  getFileUrl(filePath:string):string{if(/^https?:\/\//i.test(filePath))return filePath;return `http://localhost:5000${filePath.startsWith('/')?filePath:`/${filePath}`}`;}
  getReaderUrl(id:string):string{return `${this.api}/${id}/read`;} getDownloadUrl(id:string):string{return `${this.api}/${id}/download`;}
}
