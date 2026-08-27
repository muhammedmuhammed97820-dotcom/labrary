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
  Category
} from '../models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    `${API_CONFIG.baseUrl}/categories`;

  getCategories(): Observable<Category[]> {

    return this.http.get<Category[]>(
      this.apiUrl
    );
  }
}
