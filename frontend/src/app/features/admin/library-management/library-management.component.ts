import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector:'app-library-management',standalone:true,imports:[CommonModule,FormsModule],
  templateUrl:'./library-management.component.html',styleUrl:'./library-management.component.scss'
})
export class LibraryManagementComponent {
 private http=inject(HttpClient); public theme=inject(ThemeService); tab:'authors'|'categories'='authors'; authors:any[]=[]; categories:any[]=[]; editing:any=null; author:any={}; category:any={}; file:File|null=null; preview=''; saving=false; message=''; messageError=false; private base='http://localhost:5000/api';
 constructor(){this.load()}
 load(){this.http.get<any[]>(`${this.base}/authors`).subscribe({next:v=>this.authors=v});this.http.get<any[]>(`${this.base}/categories`).subscribe({next:v=>this.categories=v})}
 startNew(){this.editing=null;this.author={};this.category={};this.file=null;this.preview='';this.message=''}
 editAuthor(a:any){this.tab='authors';this.editing=a;this.author={...a,birthDate:a.birthDate?.slice?.(0,10),deathDate:a.deathDate?.slice?.(0,10)};this.preview=a.image?this.imageUrl(a.image):'';this.message=''}
 editCategory(c:any){this.tab='categories';this.editing=c;this.category={...c};this.message=''}
 pickImage(e:any){this.file=e.target.files?.[0]||null;if(this.file){const r=new FileReader();r.onload=()=>this.preview=String(r.result);r.readAsDataURL(this.file)}}
 saveAuthor(){this.saving=true;const fd=new FormData();Object.keys(this.author).filter(k=>!['_id','booksCount','createdAt','updatedAt'].includes(k)).forEach(k=>{if(this.author[k]!==undefined&&this.author[k]!==null)fd.append(k,this.author[k])});if(this.file)fd.append('avatar',this.file);const req=this.editing?this.http.put(`${this.base}/authors/${this.editing._id}`,fd):this.http.post(`${this.base}/authors`,fd);req.subscribe({next:()=>{this.message='تم حفظ المؤلف بنجاح.';this.messageError=false;this.startNew();this.load()},error:e=>this.fail(e),complete:()=>this.saving=false})}
 saveCategory(){this.saving=true;const req=this.editing?this.http.put(`${this.base}/categories/${this.editing._id}`,this.category):this.http.post(`${this.base}/categories`,this.category);req.subscribe({next:()=>{this.message='تم حفظ التصنيف بنجاح.';this.messageError=false;this.startNew();this.load()},error:e=>this.fail(e),complete:()=>this.saving=false})}
 removeAuthor(a:any){if(!confirm(`حذف المؤلف «${a.name}»؟`))return;this.http.delete(`${this.base}/authors/${a._id}`).subscribe({next:()=>{this.message='تم حذف المؤلف.';this.load()},error:e=>this.fail(e)})}
 removeCategory(c:any){if(!confirm(`حذف التصنيف «${c.name}»؟`))return;this.http.delete(`${this.base}/categories/${c._id}`).subscribe({next:()=>{this.message='تم حذف التصنيف.';this.load()},error:e=>this.fail(e)})}
 fail(e:any){this.saving=false;this.message=e?.error?.message||'حدث خطأ أثناء العملية.';this.messageError=true} imageUrl(v:string){return /^https?:\/\//i.test(v)?v:`http://localhost:5000${v?.startsWith('/')?v:`/${v||''}`}`}
}
