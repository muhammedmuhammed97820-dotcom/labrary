import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../core/services/book-api.service';

@Component({selector:'app-admin',standalone:true,imports:[CommonModule,RouterLink],templateUrl:'./admin.component.html',styleUrl:'./admin.component.scss'})
export class AdminComponent implements OnInit {
  private api=inject(BookApiService); books:Book[]=[]; loading=true; error='';
  ngOnInit(){this.load()}
  load(){this.loading=true;this.api.getAll().subscribe({next:b=>{this.books=b;this.loading=false},error:e=>{this.error=e?.error?.message||'تعذر تحميل إحصائيات المكتبة.';this.loading=false}})}
  get total(){return this.books.length}
  get available(){return this.books.filter(b=>b.isAvailable!==false).length}
  get views(){return this.books.reduce((n,b)=>n+(Number(b.viewsCount)||0),0)}
  get downloads(){return this.books.reduce((n,b)=>n+(Number(b.downloads)||0),0)}
  get authors(){return new Set(this.books.map(b=>typeof b.author==='string'?b.author:b.author?.name).filter(Boolean)).size}
  get categories(){return new Set(this.books.map(b=>typeof b.category==='string'?b.category:b.category?.name).filter(Boolean)).size}
  get recent(){return [...this.books].slice(-5).reverse()}
}