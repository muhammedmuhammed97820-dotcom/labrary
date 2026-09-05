import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookApiService } from '../../../../core/services/book-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({ selector: 'app-book-submit', standalone: true, imports: [CommonModule, FormsModule, RouterLink], encapsulation: ViewEncapsulation.None, templateUrl: './book-submit.component.html', styleUrl: './book-submit.component.scss' })
export class BookSubmitComponent {
  private readonly api = inject(BookApiService); private readonly router = inject(Router); private readonly notify = inject(NotificationService);
  form = { title: '', author: '', category: '', description: '', publishedYear: '' };
  bookFile: File | null = null; coverImage: File | null = null; coverPreviewUrl: string | null = null; submitting = false;
  onBookFile(e: Event) { this.bookFile = (e.target as HTMLInputElement).files?.[0] ?? null; }
  onCover(e: Event) { const f=(e.target as HTMLInputElement).files?.[0] ?? null; this.coverImage=f; if(f){const r=new FileReader();r.onload=()=>this.coverPreviewUrl=r.result as string;r.readAsDataURL(f);}else this.coverPreviewUrl=null; }
  submit(){ if(!this.form.title.trim()||!this.form.author.trim()||!this.form.category.trim()||!this.bookFile||!this.coverImage){this.notify.show('أكمل البيانات واختر ملف PDF والغلاف.','error');return;} const d=new FormData(); Object.entries(this.form).forEach(([k,v])=>d.append(k,v)); d.append('bookFile',this.bookFile); d.append('coverImage',this.coverImage); this.submitting=true; this.api.submitBook(d).subscribe({next:r=>{this.submitting=false;this.notify.show(r.message||'تم إرسال الكتاب للمراجعة.','success');this.router.navigate(['/my-submissions']);},error:e=>{this.submitting=false;this.notify.show(e?.error?.message||'تعذر إرسال الكتاب.','error');}}); }
}