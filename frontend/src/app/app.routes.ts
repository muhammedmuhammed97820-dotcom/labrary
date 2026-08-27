import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { BookDetailsComponent } from './features/books/book-details/book-details.component';
import { AuthComponent } from './features/auth/auth.component';
import { AdminComponent } from './features/admin/admin.component';
import { BookCreateComponent } from './features/admin/books/book-create/book-create.component';
import { AdminBooksComponent } from './features/admin/books/admin-books.component';
import { BookEditComponent } from './features/admin/books/book-edit/book-edit.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'books', loadComponent: () => import('./features/books/books.component').then(m => m.BooksComponent) },
  { path: 'books/:id', component: BookDetailsComponent },
  { path: 'login', component: AuthComponent },
  { path: 'register', component: AuthComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'admin/books', component: AdminBooksComponent },
  { path: 'admin/books/create', component: BookCreateComponent },
  { path: 'admin/books/:id/edit', component: BookEditComponent },
  { path: '**', redirectTo: '' }
];
