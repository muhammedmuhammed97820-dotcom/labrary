import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../core/services/theme.service';
@Component({selector:'app-author-details',standalone:true,imports:[CommonModule,DatePipe,RouterLink],templateUrl:'./author-details.component.html',styleUrl:'./author-details.component.scss'})
export class AuthorDetailsComponent{private http=inject(HttpClient);private route=inject(ActivatedRoute);public theme=inject(ThemeService);author:any=null;error='';constructor(){const id=this.route.snapshot.paramMap.get('id');this.http.get<any>(`http://localhost:5000/api/authors/${id}`).subscribe({next:v=>this.author=v,error:()=>this.error='تعذر تحميل المؤلف.'})}imageUrl(v:string){return /^https?:\/\//i.test(v)?v:`http://localhost:5000${v?.startsWith('/')?v:`/${v||''}`}`}}
