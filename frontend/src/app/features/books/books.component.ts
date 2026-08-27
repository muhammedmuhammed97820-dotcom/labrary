import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ViewEncapsulation, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
interface Book { _id?: string; id?: string|number; title?: string; description?: string; coverImage?: string; coverUrl?: string; author?: { name?: string } | string; category?: { name?: string } | string; views?: number; downloads?: number; }
interface FavoriteResponse { favorite: boolean; favorites: string[]; }
@Component({ selector: 'app-books', standalone: true, imports: [CommonModule, FormsModule, RouterLink], encapsulation: ViewEncapsulation.None, templateUrl: './books.component.html' })
export class BooksComponent implements OnInit {
  private readonly http=inject(HttpClient); private readonly auth=inject(AuthService); private readonly cdr=inject(ChangeDetectorRef);
  books:Book[]=[]; filtered:Book[]=[]; search=''; loading=true; error=''; favoriteMessage=''; favoriteBusy=new Set<string>();
  ngOnInit():void{this.loadBooks()}
  loadBooks():void{this.loading=true;this.error='';this.cdr.detectChanges();this.http.get<any>('http://localhost:5000/api/books').subscribe({next:r=>{const all:Book[]=Array.isArray(r)?r:(r?.books??r?.data??[]);this.books=Array.isArray(all)?all:[];this.applyFilter();this.loading=false;this.cdr.detectChanges()},error:err=>{console.error('Books load error:',err);this.books=[];this.filtered=[];this.error=err?.error?.message||'تعذر الاتصال بالمكتبة الرقمية';this.loading=false;this.cdr.detectChanges()}})}
  filter():void{this.applyFilter()}
  private applyFilter():void{const q=this.search.trim().toLowerCase();this.filtered=!q?[...this.books]:this.books.filter(book=>`${book.title??''} ${this.author(book)} ${this.category(book)}`.toLowerCase().includes(q))}
  id(book:Book):string{return String(book._id??book.id??'')} author(book:Book):string{return typeof book.author==='string'?book.author:book.author?.name??'مؤلف غير محدد'} category(book:Book):string{return typeof book.category==='string'?book.category:book.category?.name??'عام'}
  cover(book:Book):string{const value=book.coverImage||book.coverUrl;if(!value)return'assets/images/default-cover.svg';if(/^https?:\/\//i.test(value))return value;return`http://localhost:5000${value.startsWith('/')?value:`/${value}`}`}
  isFavorite(book:Book):boolean{const id=this.id(book);return!!id&&(this.auth.currentUser?.favorites||[]).some(favorite=>String(favorite)===id)}
  toggleFavorite(book:Book):void{const id=this.id(book);if(!id||!this.auth.isLoggedIn||this.favoriteBusy.has(id))return;this.favoriteBusy.add(id);this.favoriteMessage='';this.cdr.detectChanges();this.http.post<FavoriteResponse>(`http://localhost:5000/api/auth/favorites/${id}/toggle`,{}).subscribe({next:r=>{this.auth.updateUser({...this.auth.currentUser!,favorites:(r.favorites||[]).map(String)});this.favoriteMessage=r.favorite?'تمت إضافة الكتاب إلى المفضلة ✓':'تمت إزالة الكتاب من المفضلة ✓';this.favoriteBusy.delete(id);this.cdr.detectChanges();setTimeout(()=>{this.favoriteMessage='';this.cdr.detectChanges()},2500)},error:err=>{console.error('Favorite error:',err);this.favoriteMessage='تعذر تحديث المفضلة. حاول مرة أخرى.';this.favoriteBusy.delete(id);this.cdr.detectChanges()}})}
  isFavoriteBusy(book:Book):boolean{return this.favoriteBusy.has(this.id(book))}
}
