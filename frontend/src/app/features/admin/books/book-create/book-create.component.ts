import {
  Component,
  inject,
  OnDestroy
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  Router
} from '@angular/router';

import {
  BookService
} from '../../../../core/services/book.service';

@Component({
  selector: 'app-book-create',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl:
    './book-create.component.html',

  styleUrl:
    './book-create.component.css'
})
export class BookCreateComponent
  implements OnDestroy {

  private readonly bookService =
    inject(BookService);

  private readonly router =
    inject(Router);

  title = '';

  author = '';

  category = '';

  description = '';

  publishedYear: number | null = null;

  rating = 0;

  isAvailable = true;

  bookFile: File | null = null;

  coverImage: File | null = null;

  coverPreview: string | null = null;

  isSubmitting = false;

  successMessage = '';

  errorMessage = '';

  readonly maxBookSize =
    100 * 1024 * 1024;

  readonly maxCoverSize =
    10 * 1024 * 1024;

  onBookFileSelected(
    event: Event
  ): void {

    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    if (!file) {
      return;
    }

    this.errorMessage = '';

    if (
      file.type !==
      'application/pdf'
    ) {

      this.errorMessage =
        'يجب اختيار ملف PDF فقط.';

      input.value = '';

      this.bookFile = null;

      return;
    }

    if (
      file.size >
      this.maxBookSize
    ) {

      this.errorMessage =
        'حجم الكتاب يتجاوز 100MB.';

      input.value = '';

      this.bookFile = null;

      return;
    }

    this.bookFile = file;
  }

  onCoverSelected(
    event: Event
  ): void {

    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    if (!file) {
      return;
    }

    this.errorMessage = '';

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {

      this.errorMessage =
        'الغلاف يجب أن يكون JPG أو PNG أو WEBP.';

      input.value = '';

      this.removeCover();

      return;
    }

    if (
      file.size >
      this.maxCoverSize
    ) {

      this.errorMessage =
        'حجم صورة الغلاف يتجاوز 10MB.';

      input.value = '';

      this.removeCover();

      return;
    }

    this.coverImage = file;

    if (this.coverPreview) {

      URL.revokeObjectURL(
        this.coverPreview
      );
    }

    this.coverPreview =
      URL.createObjectURL(file);
  }

  removeCover(): void {

    if (this.coverPreview) {

      URL.revokeObjectURL(
        this.coverPreview
      );
    }

    this.coverPreview = null;

    this.coverImage = null;
  }

  removeBook(): void {
    this.bookFile = null;
  }

  formatFileSize(
    bytes: number
  ): string {

    if (!bytes) {
      return '0 Bytes';
    }

    const units = [
      'Bytes',
      'KB',
      'MB',
      'GB'
    ];

    const index =
      Math.floor(
        Math.log(bytes) /
        Math.log(1024)
      );

    return (
      (
        bytes /
        Math.pow(
          1024,
          index
        )
      ).toFixed(2) +
      ' ' +
      units[index]
    );
  }

  private validateForm(): boolean {

    this.errorMessage = '';

    if (!this.title.trim()) {

      this.errorMessage =
        'عنوان الكتاب مطلوب.';

      return false;
    }

    if (!this.author.trim()) {

      this.errorMessage =
        'اسم المؤلف مطلوب.';

      return false;
    }

    if (!this.category.trim()) {

      this.errorMessage =
        'التصنيف مطلوب.';

      return false;
    }

    if (!this.bookFile) {

      this.errorMessage =
        'يرجى اختيار ملف الكتاب PDF.';

      return false;
    }

    if (!this.coverImage) {

      this.errorMessage =
        'يرجى اختيار صورة الغلاف.';

      return false;
    }

    if (
      this.publishedYear !== null &&
      (
        this.publishedYear < 0 ||
        this.publishedYear > 2100
      )
    ) {

      this.errorMessage =
        'سنة النشر غير صحيحة.';

      return false;
    }

    if (
      this.rating < 0 ||
      this.rating > 5
    ) {

      this.errorMessage =
        'التقييم يجب أن يكون بين 0 و 5.';

      return false;
    }

    return true;
  }

  submit(): void {

    if (this.isSubmitting) {
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;

    this.successMessage = '';

    this.errorMessage = '';

    const formData =
      new FormData();

    if (!this.bookFile) {
      this.errorMessage = 'يرجى اختيار ملف الكتاب.';
      this.isSubmitting = false;
      return;
    }

    if (!this.coverImage) {
      this.errorMessage = 'يرجى اختيار صورة الغلاف.';
      this.isSubmitting = false;
      return;
    }

    formData.append('bookFile', this.bookFile, this.bookFile.name);
    formData.append('coverImage', this.coverImage, this.coverImage.name);
    formData.append(
      'title',
      this.title.trim()
    );

    formData.append(
      'author',
      this.author.trim()
    );

    formData.append(
      'category',
      this.category.trim()
    );

    formData.append(
      'description',
      this.description.trim()
    );

    if (
      this.publishedYear !== null
    ) {

      formData.append(
        'publishedYear',
        String(
          this.publishedYear
        )
      );
    }

    formData.append(
      'rating',
      String(this.rating)
    );

    formData.append(
      'isAvailable',
      String(this.isAvailable)
    );

    this.bookService
      .createBook(formData)
      .subscribe({

        next: (response) => {

          this.isSubmitting = false;

          this.successMessage =
            response.message ||
            'تم رفع الكتاب بنجاح.';

          setTimeout(() => {

            this.router.navigate([
              '/admin/books'
            ]);

          }, 1000);
        },

        error: (error) => {

          console.error(
            'Book upload error:',
            error
          );

          this.isSubmitting = false;

          this.errorMessage =
            error?.error?.message ||
            'حدث خطأ أثناء رفع الكتاب.';
        }
      });
  }

  cancel(): void {

    this.router.navigate([
      '/admin/books'
    ]);
  }

  ngOnDestroy(): void {

    if (this.coverPreview) {

      URL.revokeObjectURL(
        this.coverPreview
      );
    }
  }
}

