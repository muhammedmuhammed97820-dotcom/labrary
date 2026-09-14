import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar: string | null;
  favoritesCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserManagementResponse {
  users: ManagedUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
  stats: { totalUsers: number; totalAdmins: number; regularUsers: number };
}

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/admin/users`;

  list(page = 1, limit = 12, search = '', role = ''): Observable<UserManagementResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (search.trim()) params = params.set('search', search.trim());
    if (role) params = params.set('role', role);
    return this.http.get<UserManagementResponse>(this.api, { params });
  }

  create(data: { name: string; email: string; password: string; role: 'user' | 'admin' }): Observable<{ message: string; user: ManagedUser }> {
    return this.http.post<{ message: string; user: ManagedUser }>(this.api, data);
  }

  update(id: string, data: Partial<{ name: string; email: string; password: string; role: 'user' | 'admin' }>): Observable<{ message: string; user: ManagedUser }> {
    return this.http.put<{ message: string; user: ManagedUser }>(`${this.api}/${id}`, data);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }
}
