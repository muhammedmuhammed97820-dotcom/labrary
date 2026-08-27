import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'books', loadComponent: () => import('./features/books/books.component').then(m => m.BooksComponent) },
  { path: 'books/:id', loadComponent: () => import('./features/books/book-details/book-details.component').then(m => m.BookDetailsComponent) },
  { path: 'login', loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent) },
  { path: 'admin', loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent) },
  { path: '**', redirectTo: '' }
];
