import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookApiService, ImportedBookPreview } from '../../../core/services/book-api.service';

@Component({
  selector: 'app-arabic-import',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './arabic-import.component.html',
  styleUrl: './arabic-import.component.scss'
})
export class ArabicImportComponent {
  private readonly api = inject(BookApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  books: ImportedBookPreview[] = [];
  selected = new Set<string>();
  page = 1;
  rows = 20;
  total = 0;
  loading = false;
  importing = false;
  error = '';
  message = '';
  importResult: { imported: number; skipped: number } | null = null;

  loadPreview(): void {
    this.loading = true;
    this.error = '';
    this.message = '';
    this.selected.clear();
    this.api.previewArabicBooks(this.page, this.rows, true).subscribe({
      next: response => {
        this.books = response.books || [];
        this.total = response.total || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || 'تعذر جلب الكتب العربية من Internet Archive.';
        this.cdr.detectChanges();
      }
    });
  }

  toggle(sourceId: string): void {
    if (this.selected.has(sourceId)) this.selected.delete(sourceId);
    else this.selected.add(sourceId);
  }

  isSelected(sourceId: string): boolean { return this.selected.has(sourceId); }

  toggleAll(): void {
    if (this.allSelected) this.books.forEach(book => this.selected.delete(book.sourceId));
    else this.books.forEach(book => this.selected.add(book.sourceId));
  }

  get allSelected(): boolean {
    return this.books.length > 0 && this.books.every(book => this.selected.has(book.sourceId));
  }

  approveSelected(): void {
    const ids = [...this.selected];
    if (!ids.length || this.importing) return;

    this.importing = true;
    this.error = '';
    this.message = '';
    this.importResult = null;
    this.api.approveArabicBooks(ids).subscribe({
      next: response => {
        this.importing = false;
        this.message = response.message;
        this.importResult = { imported: response.imported?.length || 0, skipped: response.skipped?.length || 0 };
        this.selected.clear();
        this.loadPreview();
      },
      error: err => {
        this.importing = false;
        this.error = err?.error?.message || 'حدث خطأ أثناء إضافة الكتب إلى المكتبة.';
        this.cdr.detectChanges();
      }
    });
  }

  nextPage(): void {
    if (this.page * this.rows >= this.total) return;
    this.page++;
    this.loadPreview();
  }

  previousPage(): void {
    if (this.page <= 1) return;
    this.page--;
    this.loadPreview();
  }

  trackById(_: number, book: ImportedBookPreview): string { return book.sourceId; }
}
