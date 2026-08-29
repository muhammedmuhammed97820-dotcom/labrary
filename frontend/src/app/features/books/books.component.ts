import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

interface Book { _id?: string; id?: string|number; title?: string; description?: string; coverImage?: string; coverUrl?: string; author?: {name?:string;_id?:string}|string; category?: {name?:string;_id?:string}|string; views?:number; viewsCount?:number; downloads?:number; publishedYear?:number|string; isAvailable?:boolean; }
interface FavoriteResponse { favorite:boolean; favorites:string[]; }

@Component({selector:'app-books',standalone:true,imports:[CommonModule,FormsModule,RouterLink],encapsulation:ViewEncapsulation.None,templateUrl:'./books.component.html',styleUrl:'./books.component.scss'})
export class BooksComponent implements OnInit {
 private readonly http=inject(HttpClient); private readonly auth=inject(AuthService); private readonly notify=inject(NotificationService); private readonly cdr=inject(ChangeDetectorRef); private readonly route=inject(ActivatedRoute); public readonly themeService=inject(ThemeService); private readonly serverOrigin='http://localhost:5000';
 books:Book[]=[]; query=''; loading=true; error=''; favoriteBusy=new Set<string>(); directoryTitle='المكتبة';
 ngOnInit(){this.route.queryParamMap.subscribe(params=>{const category=params.get('category');const author=params.get('author');this.directoryTitle=category?'كتب التصنيف':author?'كتب المؤلف':'المكتبة';this.load(false,category,author);});}
 get filteredBooks(){const q=this.query.trim().toLowerCase();if(!q)return this.books;return this.books.filter(book=>{const author=typeof book.author==='string'?book.author:book.author?.name;const category=typeof book.category==='string'?book.category:book.category?.name;return [book.title,author,category,book.description].some(v=>String(v??'').toLowerCase().includes(q));});}
 load(showNotify=true,category?:string|null,author?:string|null){this.loading=true;this.error='';let url=`${this.serverOrigin}/api/books`;const params:string[]=[];if(category)params.push(`category=${encodeURIComponent(category)}`);if(author)params.push(`author=${encodeURIComponent(author)}`);if(params.length)url+='?'+params.join('&');this.http.get<any>(url).subscribe({next:r=>{this.books=Array.isArray(r)?r:(r.books??r.data??[]);this.loading=false;if(showNotify)this.notify.show('تم تحديث قائمة الكتب بنجاح.','info');this.cdr.detectChanges()},error:err=>{console.error('Fetch books error:',err);this.error=err?.error?.message||'تعذر الاتصال بالمكتبة الرقمية.';this.loading=false;this.notify.show(this.error,'error');this.cdr.detectChanges()}})}
 getBookId(book:any){return String(book?._id??book?.id??'')}
 authorName(book:Book){return typeof book.author==='string'?book.author:book.author?.name||'مؤلف غير محدد'}
 categoryName(book:Book){return typeof book.category==='string'?book.category:book.category?.name||'عام'}
 getBookCover(book:any){const cover=book?.coverImage||book?.coverUrl||book?.cover;if(!cover)return null;if(/^data:|^blob:|^https?:\/\//i.test(cover))return cover;return `${this.serverOrigin}${cover.startsWith('/')?cover:`/${cover}`}`}
 isFavorite(book:Book){const id=this.getBookId(book);if(!id)return false;const favorites=this.auth.currentUser?.favorites||[];return favorites.some((f:any)=>String(f?._id||f?.id||f)===id)}
 toggleFavorite(book:Book){const id=this.getBookId(book);if(!id||this.favoriteBusy.has(id))return;if(!this.auth.isLoggedIn){this.notify.show('سجّل الدخول أولًا لإضافة الكتب إلى المفضلة.','error');return}this.favoriteBusy.add(id);this.http.post<FavoriteResponse>(`${this.serverOrigin}/api/auth/favorites/${id}/toggle`,{}).subscribe({next:r=>{const user=this.auth.currentUser;if(user)this.auth.updateUser({...user,favorites:(r.favorites||[]).map(String)});this.notify.show(r.favorite?'تمت إضافة الكتاب إلى المفضلة ✓':'تمت إزالة الكتاب من المفضلة ✓','success');this.favoriteBusy.delete(id);this.cdr.detectChanges()},error:err=>{console.error('Toggle favorite error:',err);this.notify.show('تعذر تحديث المفضلة. حاول مرة أخرى.','error');this.favoriteBusy.delete(id);this.cdr.detectChanges()}})}
 isFavoriteBusy(b:Book){return this.favoriteBusy.has(this.getBookId(b))}
}
