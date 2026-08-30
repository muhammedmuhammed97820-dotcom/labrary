import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
interface Author { _id:string; name:string; bio?:string; image?:string; nationality?:string; booksCount?:number; }
@Component({selector:'app-authors',standalone:true,imports:[CommonModule,RouterLink],templateUrl:'./authors.component.html',styleUrl:'./authors.component.scss'})
export class AuthorsComponent{private http=inject(HttpClient);public theme=inject(ThemeService);authors:Author[]=[];loading=true;error='';constructor(){this.http.get<Author[]>('http://localhost:5000/api/authors').subscribe({next:v=>{this.authors=v;this.loading=false},error:()=>{this.error='تعذر تحميل المؤلفين.';this.loading=false}})}imageUrl(v:string){return /^https?:\/\//i.test(v)?v:`http://localhost:5000${v.startsWith('/')?v:`/${v}`}`}initial(n:string){return n?.trim()?.charAt(0)||'م'}}
