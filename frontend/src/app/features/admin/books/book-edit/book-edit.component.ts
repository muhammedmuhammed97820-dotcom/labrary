import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../../../core/services/book-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-book-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './book-edit.component.html',
  styleUrl: './book-edit.component.scss'
})
export class BookEditComponent implements OnInit {
  private readonly api = inject(BookApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  id = '';
  loading = true;
  saving = false;
  
  book: Book = {
    title: '',
    author: '',
    category: '',
    description: '',
    publishedYear: undefined,
    rating: 0,
    isAvailable: true
  };

  pdf?: File;
  cover?: File;
  coverPreviewUrl: string | null = null;

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (!this.id) {
      this.notify.show('معرّف الكتاب غير موجود أو غير صالح.', 'error');
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }
    this.loadBook();
  }

  private loadBook(): void {
    this.loading = true;
    this.api.getById(this.id).subscribe({
      next: b => {
        this.book = b;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: e => {
        console.error('Book edit load error:', e);
        const msg = e?.error?.message || 'تعذر تحميل بيانات الكتاب.';
        this.notify.show(msg, 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFile(e: Event, type: 'pdf' | 'cover'): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (type === 'pdf') {
      this.pdf = file;
    } else {
      this.cover = file;
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          this.coverPreviewUrl = reader.result as string;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      } else {
        this.coverPreviewUrl = null;
      }
    }
  }

  save(): void {
    if (!this.book.title.trim()) {
      this.notify.show('عنوان الكتاب مطلوب بشكل أساسي.', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('title', this.book.title);
    fd.append('author', typeof this.book.author === 'string' ? this.book.author : this.book.author?.name || '');
    fd.append('category', typeof this.book.category === 'string' ? this.book.category : this.book.category?.name || '');
    fd.append('description', this.book.description || '');
    
    if (this.book.publishedYear != null) fd.append('publishedYear', String(this.book.publishedYear));
    if (this.book.rating != null) fd.append('rating', String(this.book.rating));
    fd.append('isAvailable', String(this.book.isAvailable !== false));
    
    if (this.pdf) fd.append('file', this.pdf);
    if (this.cover) fd.append('cover', this.cover);

    this.saving = true;
    this.cdr.detectChanges();

    this.api.update(this.id, fd).subscribe({
      next: () => {
        this.notify.show(`تم تحديث بيانات كتاب «${this.book.title}» بنجاح.`, 'success');
        this.saving = false;
        setTimeout(() => this.router.navigate(['/admin/books']), 600);
      },
      error: e => {
        const msg = e?.error?.message || 'فشل حفظ التعديلات على الكتاب.';
        this.notify.show(msg, 'error');
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  get authorName(): string {
    return typeof this.book.author === 'string' ? this.book.author : this.book.author?.name || '';
  }

  set authorName(val: string) {
    this.book.author = val;
  }

  get categoryName(): string {
    return typeof this.book.category === 'string' ? this.book.category : this.book.category?.name || '';
  }

  set categoryName(val: string) {
    this.book.category = val;
  }
}