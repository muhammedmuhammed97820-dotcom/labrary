import { BookCreateComponent } from './features/admin/books/book-create/book-create.component';
import {
  Routes
} from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin/books/create',
    component: BookCreateComponent
  },

  {
    path: '',
    loadComponent: () =>
      import(
        './features/home/home.component'
      ).then(
        m => m.HomeComponent
      )
  },

  {
    path: 'books',
    loadComponent: () =>
      import(
        './features/books/book-list/book-list.component'
      ).then(
        m => m.BookListComponent
      )
  },

  {
    path: 'books/:id',
    loadComponent: () =>
      import(
        './features/books/book-details/book-details.component'
      ).then(
        m => m.BookDetailsComponent
      )
  },

  {
    path: 'admin',
    loadComponent: () =>
      import(
        './features/admin/dashboard/dashboard.component'
      ).then(
        m => m.DashboardComponent
      )
  },

  {
    path: 'admin/books',
    loadComponent: () =>
      import(
        './features/admin/books/book-list/admin-book-list.component'
      ).then(
        m => m.AdminBookListComponent
      )
  },

  {
    path: '**',
    redirectTo: ''
  }

];


