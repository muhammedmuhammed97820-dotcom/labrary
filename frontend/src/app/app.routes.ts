import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'books',
    loadComponent: () =>
      import('./features/books/books.component')
        .then(m => m.BooksComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
