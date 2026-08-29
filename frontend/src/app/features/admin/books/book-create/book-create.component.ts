import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookApiService } from '../../../../core/services/book-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-book-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './book-create.component.html',
  styleUrl: './book-create.component.scss'
})
export class BookCreateComponent {
  private readonly api = inject(BookApiService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  form = {
    title: '',
    author: '',
    category: '',
    description: '',
    publishedYear: '',
    rating: 0
  };

  bookFile: File | null = null;
  coverImage: File | null = null;
  coverPreviewUrl: string | null = null;
  submitting = false;

  onBookFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.bookFile = input.files?.[0] ?? null;
  }

  onCover(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.coverImage = file;

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.coverPreviewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      this.coverPreviewUrl = null;
    }
  }

  submit(): void {
    if (!this.form.title.trim() || !this.form.author.trim() || !this.form.category.trim() || !this.bookFile || !this.coverImage) {
      this.notify.show('يرجى إكمال جميع الحقول المطلوبة واختيار ملف PDF والغلاف.', 'error');
      return;
    }

    const data = new FormData();
    Object.entries(this.form).forEach(([k, v]) => data.append(k, String(v)));
    data.append('bookFile', this.bookFile);
    data.append('coverImage', this.coverImage);

    this.submitting = true;
    this.api.create(data).subscribe({
      next: r => {
        this.submitting = false;
        this.notify.show(r.message || 'تمت إضافة الكتاب بنجاح إلى المكتبة.', 'success');
        setTimeout(() => this.router.navigate(['/admin/books']), 600);
      },
      error: e => {
        this.submitting = false;
        const msg = e?.error?.message || 'تعذر إضافة الكتاب. تأكد من اتصال الـ Backend.';
        this.notify.show(msg, 'error');
      }
    });
  }
}