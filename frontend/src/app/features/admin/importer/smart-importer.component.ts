import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SmartImporterService, ImportCandidate } from '../../../core/services/smart-importer.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-smart-importer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './smart-importer.component.html',
  styleUrl: './smart-importer.component.scss'
})
export class SmartImporterComponent {
  private readonly importer = inject(SmartImporterService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  sourceUrl = 'https://foulabook.com/';
  maxPages = 20;
  maxBooks = 50;
  downloadPdf = false;
  loading = false;
  approving = false;
  error = '';
  scannedPages = 0;
  books: ImportCandidate[] = [];

  preview(): void {
    if (!this.sourceUrl.trim()) return;
    this.loading = true;
    this.error = '';
    this.books = [];
    this.importer.preview(this.sourceUrl.trim(), this.maxPages, this.maxBooks).subscribe({
      next: result => {
        this.books = (result.books || []).map(book => ({ ...book, selected: !book.duplicate }));
        this.scannedPages = result.scannedPages;
        this.loading = false;
        this.notify.show(`تم العثور على ${this.books.length} كتاب عربي للمراجعة.`, 'success');
        this.cdr.detectChanges();
      },
      error: err => {
        this.error = err?.error?.message || 'فشل تحليل الموقع.';
        this.loading = false;
        this.notify.show(this.error, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  toggleAll(checked: boolean): void {
    this.books.forEach(book => { if (!book.duplicate) book.selected = checked; });
  }

  selectedBooks(): ImportCandidate[] {
    return this.books.filter(book => book.selected && !book.duplicate);
  }

  approveSelected(): void {
    const selected = this.selectedBooks();
    if (!selected.length) {
      this.notify.show('حدد كتاباً واحداً على الأقل.', 'info');
      return;
    }
    this.approving = true;
    this.importer.approve(selected, this.downloadPdf).subscribe({
      next: result => {
        const saved = (result.results || []).filter((item: any) => !item.skipped).length;
        const skipped = (result.results || []).filter((item: any) => item.skipped).length;
        this.books = this.books.filter(book => !selected.includes(book));
        this.approving = false;
        this.notify.show(`تمت إضافة ${saved} كتاب، وتجاوز ${skipped} كتاب.`, 'success');
        this.cdr.detectChanges();
      },
      error: err => {
        this.approving = false;
        this.notify.show(err?.error?.message || 'فشلت عملية الحفظ.', 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
