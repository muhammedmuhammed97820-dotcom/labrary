import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../../../core/services/book-api.service';

@Component({selector:'app-book-edit',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./book-edit.component.html',styleUrl:'./book-edit.component.scss'})
export class BookEditComponent implements OnInit {
  private api=inject(BookApiService); private route=inject(ActivatedRoute); private router=inject(Router);
  id=''; loading=true; saving=false; error=''; book:Book={title:'',author:'',category:'',description:'',publishedYear:undefined,rating:0,isAvailable:true};
  pdf?:File; cover?:File;
  ngOnInit(){this.id=this.route.snapshot.paramMap.get('id')||''; if(!this.id){this.error='معرّف الكتاب غير موجود.';this.loading=false;return;} this.api.getById(this.id).subscribe({next:b=>{this.book=b;this.loading=false},error:e=>{this.error=e?.error?.message||'تعذر تحميل الكتاب.';this.loading=false}})}
  onFile(e:Event,type:'pdf'|'cover'){const f=(e.target as HTMLInputElement).files?.[0];if(type==='pdf')this.pdf=f;else this.cover=f}
  save(){if(!this.book.title.trim()){this.error='عنوان الكتاب مطلوب.';return}const fd=new FormData();fd.append('title',this.book.title);fd.append('author',typeof this.book.author==='string'?this.book.author:this.book.author.name);fd.append('category',typeof this.book.category==='string'?this.book.category:this.book.category.name);fd.append('description',this.book.description||'');if(this.book.publishedYear!=null)fd.append('publishedYear',String(this.book.publishedYear));if(this.book.rating!=null)fd.append('rating',String(this.book.rating));fd.append('isAvailable',String(this.book.isAvailable!==false));if(this.pdf)fd.append('file',this.pdf);if(this.cover)fd.append('cover',this.cover);this.saving=true;this.error='';this.api.update(this.id,fd).subscribe({next:()=>this.router.navigate(['/admin']),error:e=>{this.error=e?.error?.message||'فشل حفظ التعديلات.';this.saving=false}})}
}
