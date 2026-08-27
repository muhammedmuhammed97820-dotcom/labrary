import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';

import {
  API_CONFIG
} from '../constants/api.constants';

import {
  Author
} from '../models/author.model';

@Injectable({
  providedIn: 'root'
})
export class AuthorService {

  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    `${API_CONFIG.baseUrl}/authors`;

  getAuthors(): Observable<Author[]> {

    return this.http.get<Author[]>(
      this.apiUrl
    );
  }
}
