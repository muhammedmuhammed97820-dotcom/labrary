import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../core/services/book-api.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';

interface SmartImportStatus {
  running: boolean; startedAt: string | null; finishedAt: string | null; error: string; url: string; stage: string;
  pages: number; discovered: number; normalized: number; imported: number; result: any;
}

@Component({
  selector: 'app-admin', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None, templateUrl: './admin.component.html', styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private readonly api = inject(BookApiService);
  private readonly http = inject(HttpClient);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly themeService = inject(ThemeService);
  private readonly serverOrigin = 'http://localhost:5000';

  books: Book[] = []; loading = true; error = '';
  smartImportRunning = false; smartImportMessage = ''; smartImportOutput: string[] = [];
  smartLibraryUrl = '';
  smartMaxPages = 30;
  smartImportNow = true;
  smartDownloadFiles = false;
  smartUpdateExisting = false;
  smartProgress: SmartImportStatus = this.emptySmartProgress();

  ngOnInit(): void { this.load(); this.refreshSmartImportStatus(); }

  private emptySmartProgress(): SmartImportStatus {
    return { running: false, startedAt: null, finishedAt: null, error: '', url: '', stage: 'idle', pages: 0, discovered: 0, normalized: 0, imported: 0, result: null };
  }

  load(): void {
    this.loading = true; this.error = '';
    this.api.getAdminAll().subscribe({
      next: b => { this.books = b; this.loading = false; this.cdr.detectChanges(); },
      error: e => { console.error('Admin books load error:', e); this.error = e?.error?.message || 'تعذر تحميل إحصائيات المكتبة.'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  startSmartImport(): void {
    const url = this.smartLibraryUrl.trim();
    if (this.smartImportRunning || !/^https?:\/\//i.test(url)) {
      this.notify.show('أدخل رابط مكتبة صحيحاً يبدأ بـ http أو https.', 'error');
      return;
    }
    const confirmed = window.confirm('سيقوم الوكيل الذكي بفحص الموقع وتحويل البيانات إلى حقول مكتبتك الحالية دون تغيير مخطط قاعدة البيانات. هل تريد البدء؟');
    if (!confirmed) return;
    this.smartImportRunning = true;
    this.smartImportMessage = 'جارِ فحص المكتبة وتحليل الكتب...';
    this.http.post<any>(`${this.serverOrigin}/api/import/smart/scan`, {
      url, maxPages: this.smartMaxPages, importNow: this.smartImportNow,
      downloadFiles: this.smartDownloadFiles, updateExisting: this.smartUpdateExisting
    }).subscribe({
      next: response => { this.smartImportMessage = response?.message || 'بدأ الاستيراد الذكي.'; this.notify.show(this.smartImportMessage, 'success'); this.refreshSmartImportStatus(); },
      error: error => { this.smartImportRunning = false; this.smartImportMessage = error?.error?.message || 'تعذر بدء الاستيراد الذكي.'; this.notify.show(this.smartImportMessage, 'error'); this.cdr.detectChanges(); }
    });
  }

  refreshSmartImportStatus(): void {
    this.http.get<any>(`${this.serverOrigin}/api/import/smart/status`).subscribe({
      next: status => {
        this.smartProgress = { ...this.emptySmartProgress(), ...status };
        this.smartImportRunning = Boolean(status?.running);
        if (this.smartProgress.running) this.smartImportMessage = 'الوكيل الذكي يعمل ويحلل بيانات المكتبة...';
        else if (this.smartProgress.error) this.smartImportMessage = this.smartProgress.error;
        else if (this.smartProgress.finishedAt) this.smartImportMessage = `اكتملت العملية: ${this.smartProgress.imported} كتاب.`;
        this.cdr.detectChanges();
        if (this.smartImportRunning) window.setTimeout(() => this.refreshSmartImportStatus(), 2000);
      },
      error: () => { this.cdr.detectChanges(); if (this.smartImportRunning) window.setTimeout(() => this.refreshSmartImportStatus(), 5000); }
    });
  }

  getBookCover(book: any): string | null { const cover = book?.coverImage || book?.coverUrl || book?.cover; if (!cover) return null; if (/^data:|^blob:|^https?:\/\//i.test(cover)) return cover; return `${this.serverOrigin}${cover.startsWith('/') ? cover : `/${cover}`}`; }
  getAuthorName(author: any): string { if (!author) return 'مؤلف غير معروف'; return typeof author === 'string' ? author : author.name || 'مؤلف غير معروف'; }
  get total(): number { return this.books.length; }
  get available(): number { return this.books.filter(b => b.isAvailable !== false).length; }
  get views(): number { return this.books.reduce((n, b) => n + (Number(b.viewsCount) || 0), 0); }
  get downloads(): number { return this.books.reduce((n, b) => n + (Number(b.downloads) || 0), 0); }
  get authors(): number { return new Set(this.books.map(b => typeof b.author === 'string' ? b.author : b.author?.name).filter(Boolean)).size; }
  get categories(): number { return new Set(this.books.map(b => typeof b.category === 'string' ? b.category : b.category?.name).filter(Boolean)).size; }
  get recent(): Book[] { return [...this.books].sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)).slice(0, 5); }
}
