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
        this.notify.show(e?.error?.message || 'تعذر تحميل بيانات الكتاب.', 'error');
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
    const title = this.book.title?.trim() || '';
    const author = this.authorName.trim();
    const category = this.categoryName.trim();

    if (!title) return void this.notify.show('عنوان الكتاب مطلوب ولا يمكن حفظ التعديلات بدونه.', 'error');
    if (!author) return void this.notify.show('اسم المؤلف مطلوب ولا يمكن حفظ التعديلات بدونه.', 'error');
    if (!category) return void this.notify.show('التصنيف مطلوب ولا يمكن حفظ التعديلات بدونه.', 'error');
    if (this.book.publishedYear != null && (!Number.isInteger(Number(this.book.publishedYear)) || Number(this.book.publishedYear) < 0)) {
      return void this.notify.show('سنة النشر يجب أن تكون سنة صحيحة.', 'error');
    }
    if (this.book.rating != null && (Number(this.book.rating) < 0 || Number(this.book.rating) > 5)) {
      return void this.notify.show('التقييم يجب أن يكون بين 0 و5.', 'error');
    }

    const fd = new FormData();
    fd.append('title', title);
    fd.append('author', author);
    fd.append('category', category);
    fd.append('description', this.book.description?.trim() || '');
    if (this.book.publishedYear != null) fd.append('publishedYear', String(this.book.publishedYear));
    if (this.book.rating != null) fd.append('rating', String(this.book.rating));
    fd.append('isAvailable', String(this.book.isAvailable !== false));

    // Backend upload middleware expects these exact field names.
    if (this.pdf) fd.append('bookFile', this.pdf);
    if (this.cover) fd.append('coverImage', this.cover);

    this.saving = true;
    this.cdr.detectChanges();

    this.api.update(this.id, fd).subscribe({
      next: () => {
        this.notify.show(`تم تحديث بيانات كتاب «${title}» بنجاح.`, 'success');
        this.saving = false;
        setTimeout(() => this.router.navigate(['/admin/books']), 600);
      },
      error: e => {
        this.notify.show(e?.error?.message || 'فشل حفظ التعديلات على الكتاب.', 'error');
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  get authorName(): string {
    return typeof this.book.author === 'string' ? this.book.author : this.book.author?.name || '';
  }

  set authorName(val: string) { this.book.author = val; }

  get categoryName(): string {
    return typeof this.book.category === 'string' ? this.book.category : this.book.category?.name || '';
  }

  set categoryName(val: string) { this.book.category = val; }
}
