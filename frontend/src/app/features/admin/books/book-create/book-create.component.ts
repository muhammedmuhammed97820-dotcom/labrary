import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookApiService } from '../../../../core/services/book-api.service';

@Component({
  selector: 'app-book-create', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './book-create.component.html', styleUrl: './book-create.component.scss'
})
export class BookCreateComponent {
  private api = inject(BookApiService); private router = inject(Router);
  form = { title:'', author:'', category:'', description:'', publishedYear:'', rating:0 };
  bookFile: File | null = null; coverImage: File | null = null; submitting = false; error=''; success='';
  onBookFile(e: Event) { this.bookFile = (e.target as HTMLInputElement).files?.[0] ?? null; }
  onCover(e: Event) { this.coverImage = (e.target as HTMLInputElement).files?.[0] ?? null; }
  submit() {
    this.error=''; this.success='';
    if (!this.form.title.trim() || !this.form.author.trim() || !this.form.category.trim() || !this.bookFile || !this.coverImage) { this.error='أكمل الحقول المطلوبة واختر ملف PDF والغلاف.'; return; }
    const data = new FormData(); Object.entries(this.form).forEach(([k,v]) => data.append(k, String(v)));
    data.append('bookFile', this.bookFile); data.append('coverImage', this.coverImage); this.submitting=true;
    this.api.create(data).subscribe({ next: r => { this.success=r.message || 'تمت إضافة الكتاب بنجاح.'; this.submitting=false; setTimeout(()=>this.router.navigate(['/admin']),700); }, error: e => { this.error=e?.error?.message || 'تعذر إضافة الكتاب. تأكد من تشغيل الـBackend.'; this.submitting=false; } });
  }
}
