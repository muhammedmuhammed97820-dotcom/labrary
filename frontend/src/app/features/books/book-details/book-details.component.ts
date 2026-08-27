import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  ElementRef,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, finalize, takeUntil, timeout } from 'rxjs';

import { BookService } from '../../../core/services/book.service';
import { Book } from '../../../core/models/book.model';

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

@Component({
  selector: 'app-book-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './book-details.component.html',
  styleUrl: './book-details.component.css'
})
export class BookDetailsComponent implements OnInit, OnDestroy {

  readonly bookService = inject(BookService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();

  @ViewChild('pdfContainer') pdfContainer?: ElementRef<HTMLDivElement>;

  book: Book | null = null;
  loading = true;
  error = '';
  imageError = false;
  downloading = false;

  readerOpen = false;
  pdfLoading = false;
  pdfError = '';
  pdfPageCount = 0;
  pdfCurrentPage = 0;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'معرّف الكتاب غير موجود';
      this.loading = false;
      return;
    }
    this.loadBook(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.style.overflow = '';
  }

  loadBook(id: string): void {
    this.loading = true;
    this.error = '';

    this.bookService
      .getBook(id)
      .pipe(
        timeout(15000),
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response?.book) {
            this.book = response.book;
          } else if (response?.data) {
            this.book = response.data;
          } else {
            this.book = response;
          }

          if (this.book?._id) {
            this.bookService
              .incrementViews(this.book._id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (result) => {
                  if (this.book) this.book.viewsCount = result.viewsCount;
                  this.cdr.detectChanges();
                },
                error: (err) => console.warn('[Library] View counter error:', err)
              });
          }
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.book = null;
          this.error = err?.name === 'TimeoutError'
            ? 'الخادم لم يستجب. تأكد أن الـ Backend يعمل.'
            : (err?.error?.message || 'تعذر تحميل بيانات الكتاب.');
          this.cdr.detectChanges();
        }
      });
  }

  getCover(): string {
    if (!this.book?.coverImage) return 'assets/images/default-book-cover.svg';
    return this.bookService.getCoverUrl(this.book.coverImage);
  }

  onImageError(event: Event): void {
    this.imageError = true;
    const image = event.target as HTMLImageElement;
    if (image) image.src = 'assets/images/default-book-cover.svg';
  }

  getAuthorName(): string {
    if (!this.book) return 'غير معروف';
    return typeof this.book.author === 'string' ? this.book.author : (this.book.author?.name || 'غير معروف');
  }

  getCategoryName(): string {
    if (!this.book) return 'عام';
    return typeof this.book.category === 'string' ? this.book.category : (this.book.category?.name || 'عام');
  }

  async openReader(): Promise<void> {
    if (!this.book?.filePath) {
      alert('ملف الكتاب غير متوفر.');
      return;
    }

    if (this.readerOpen) return;

    this.readerOpen = true;
    this.pdfLoading = true;
    this.pdfError = '';
    this.pdfPageCount = 0;
    this.pdfCurrentPage = 0;

    document.body.style.overflow = 'hidden';
    this.cdr.detectChanges();

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await this.loadPdfIntoReader();
  }

  private async loadPdfIntoReader(): Promise<void> {
    if (!this.book?.filePath) return;

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        this.bookService
          .getBookFileBlob(this.book!.filePath!)
          .pipe(takeUntil(this.destroy$), timeout(30000))
          .subscribe({
            next: (value: Blob) => resolve(value),
            error: (err: any) => reject(err)
          });
      });

      if (!blob || blob.size === 0) {
        throw new Error('الملف القادم من السيرفر فارغ.');
      }

      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const loadingTask = pdfjsLib.getDocument({
        data: bytes,
        disableAutoFetch: true,
        disableStream: true,
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/cmaps/`,
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;

      this.pdfPageCount = pdf.numPages;
      this.pdfCurrentPage = 1;
      this.pdfLoading = false;
      this.cdr.detectChanges();

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await this.renderAllPages(pdf);

    } catch (error: any) {
      console.error('[Library] PDF reader error details:', error);
      this.pdfLoading = false;
      this.pdfError = error?.message || 'تعذر جلب ملف الكتاب من السيرفر.';
      this.cdr.detectChanges();
    }
  }

  private async renderAllPages(pdf: any): Promise<void> {
    if (!this.pdfContainer) return;
    const container = this.pdfContainer.nativeElement;
    container.innerHTML = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (!this.readerOpen) break;

      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(container.clientWidth - 40, 300);
      const scale = Math.min(Math.max(availableWidth / baseViewport.width, 1), 1.8);
      const viewport = page.getViewport({ scale });

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';

      const pageNumberLabel = document.createElement('div');
      pageNumberLabel.className = 'pdf-page-number';
      pageNumberLabel.textContent = `صفحة ${pageNumber} من ${pdf.numPages}`;

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) continue;

      await page.render({ canvasContext: context, viewport }).promise;

      pageWrapper.appendChild(pageNumberLabel);
      pageWrapper.appendChild(canvas);
      container.appendChild(pageWrapper);
    }
  }

  closeReader(): void {
    this.readerOpen = false;
    this.pdfLoading = false;
    this.pdfError = '';
    if (this.pdfContainer) this.pdfContainer.nativeElement.innerHTML = '';
    document.body.style.overflow = '';
    this.cdr.detectChanges();
  }

  onReaderBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeReader();
  }

  downloadBook(): void {
    if (!this.book?.filePath || this.downloading) return;
    this.downloading = true;

    if (this.book._id) {
      this.bookService.incrementDownloads(this.book._id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => { if (this.book) this.book.downloads = res.downloads; }
        });
    }

    this.bookService.getBookFileBlob(this.book.filePath)
      .pipe(takeUntil(this.destroy$), timeout(60000), finalize(() => {
        this.downloading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${this.book?.title || 'book'}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        },
        error: () => alert('تعذر تحميل الكتاب.')
      });
  }
}