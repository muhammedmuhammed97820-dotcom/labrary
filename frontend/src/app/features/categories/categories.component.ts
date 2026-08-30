import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
interface Category {_id:string;name:string;description?:string;booksCount?:number}
@Component({selector:'app-categories',standalone:true,imports:[CommonModule,RouterLink],templateUrl:'./categories.component.html',styleUrl:'./categories.component.scss'})
export class CategoriesComponent{private http=inject(HttpClient);public theme=inject(ThemeService);categories:Category[]=[];loading=true;error='';constructor(){this.http.get<Category[]>('http://localhost:5000/api/categories').subscribe({next:v=>{this.categories=v;this.loading=false},error:()=>{this.error='تعذر تحميل التصنيفات.';this.loading=false}})}}
