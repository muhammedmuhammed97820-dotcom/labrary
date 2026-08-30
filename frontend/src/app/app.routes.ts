import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { BookDetailsComponent } from './features/books/book-details/book-details.component';
import { AuthComponent } from './features/auth/auth.component';
import { AdminComponent } from './features/admin/admin.component';
import { BookCreateComponent } from './features/admin/books/book-create/book-create.component';
import { AdminBooksComponent } from './features/admin/books/admin-books.component';
import { BookEditComponent } from './features/admin/books/book-edit/book-edit.component';
import { ProfileComponent } from './features/profile/profile.component';
import { adminGuard } from './core/guards/admin.guard';
import { CategoriesComponent } from './features/categories/categories.component';
import { AuthorsComponent } from './features/authors/authors.component';
import { AuthorDetailsComponent } from './features/authors/author-details.component';
import { AuthorsManagementComponent } from './features/admin/authors/authors-management.component';
import { CategoriesManagementComponent } from './features/admin/categories/categories-management.component';
export const routes: Routes = [
 {path:'',component:HomeComponent},{path:'books',loadComponent:()=>import('./features/books/books.component').then(m=>m.BooksComponent)},{path:'books/:id',component:BookDetailsComponent},{path:'categories',component:CategoriesComponent},{path:'authors',component:AuthorsComponent},{path:'authors/:id',component:AuthorDetailsComponent},{path:'login',component:AuthComponent},{path:'register',component:AuthComponent},{path:'profile',component:ProfileComponent},{path:'favorites',loadComponent:()=>import('./features/favorites/favorites.component').then(m=>m.FavoritesComponent)},{path:'admin',component:AdminComponent,canActivate:[adminGuard]},{path:'admin/books',component:AdminBooksComponent,canActivate:[adminGuard]},{path:'admin/books/create',component:BookCreateComponent,canActivate:[adminGuard]},{path:'admin/books/:id/edit',component:BookEditComponent,canActivate:[adminGuard]},{path:'admin/authors',component:AuthorsManagementComponent,canActivate:[adminGuard]},{path:'admin/categories',component:CategoriesManagementComponent,canActivate:[adminGuard]},{path:'**',redirectTo:''}];
