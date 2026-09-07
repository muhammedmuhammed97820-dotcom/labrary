import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../core/services/book-api.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';

interface AcoImportStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  output: string[];
  total: number;
  processed: number;
  remaining: number;
  percent: number;
  pdfDownloaded: number;
  coversDownloaded: number;
  current: string;
  etaSeconds: number | null;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private readonly api = inject(BookApiService);
  private readonly http = inject(HttpClient);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly themeService = inject(ThemeService);
  private readonly serverOrigin = 'http://localhost:5000';

  books: Book[] = [];
  loading = true;
  error = '';
  acoImportRunning = false;
  acoImportMessage = '';
  acoImportOutput: string[] = [];
  acoProgress: AcoImportStatus = this.emptyAcoProgress();

  ngOnInit(): void {
    this.load();
    this.refreshAcoImportStatus();
  }

  private emptyAcoProgress(): AcoImportStatus {
    return {
      running: false,
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      output: [],
      total: 0,
      processed: 0,
      remaining: 0,
      percent: 0,
      pdfDownloaded: 0,
      coversDownloaded: 0,
      current: '',
      etaSeconds: null
    };
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getAdminAll().subscribe({
      next: b => {
        this.books = b;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: e => {
        console.error('Admin books load error:', e);
        this.error = e?.error?.message || 'تعذر تحميل إحصائيات المكتبة.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startAcoFullImport(): void {
    if (this.acoImportRunning) return;

    const confirmed = window.confirm(
      'سيبدأ هذا تنزيل ملفات PDF منخفضة الدقة والأغلفة لكل كتب ACO المتاحة وإيداعها داخل MongoDB/GridFS. قد تحتاج العملية مساحة تخزين كبيرة ووقتاً طويلاً. هل تريد المتابعة؟'
    );
    if (!confirmed) return;

    this.acoImportRunning = true;
    this.acoImportMessage = 'جارِ بدء الاستيراد الجماعي...';
    this.http.post<any>(`${this.serverOrigin}/api/import/aco/full`, {
      pdf: 'low',
      concurrency: 1
    }).subscribe({
      next: response => {
        this.acoImportMessage = response?.message || 'بدأ الاستيراد الجماعي.';
        this.notify.show(this.acoImportMessage, 'success');
        this.refreshAcoImportStatus();
      },
      error: error => {
        this.acoImportRunning = false;
        this.acoImportMessage = error?.error?.message || 'تعذر بدء الاستيراد الجماعي.';
        this.notify.show(this.acoImportMessage, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  refreshAcoImportStatus(): void {
    this.http.get<any>(`${this.serverOrigin}/api/import/aco/status`).subscribe({
      next: status => {
        this.acoProgress = {
          ...this.emptyAcoProgress(),
          ...status,
          output: Array.isArray(status?.output) ? status.output : []
        };
        this.acoImportRunning = Boolean(status?.running);
        this.acoImportOutput = this.acoProgress.output;

        if (this.acoProgress.running) {
          this.acoImportMessage = 'جارِ تنزيل الكتب والملفات إلى قاعدة البيانات...';
        } else if (this.acoProgress.finishedAt && this.acoProgress.exitCode === 0) {
          this.acoImportMessage = 'اكتمل تنزيل ملفات ACO.';
        }

        this.cdr.detectChanges();
        if (this.acoImportRunning) {
          window.setTimeout(() => this.refreshAcoImportStatus(), 2000);
        }
      },
      error: () => {
        this.cdr.detectChanges();
        if (this.acoImportRunning) {
          window.setTimeout(() => this.refreshAcoImportStatus(), 5000);
        }
      }
    });
  }

  formatEta(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds)) return 'جارٍ الحساب...';
    const value = Math.max(0, Math.round(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    if (hours) return `${hours}س ${minutes}د`;
    if (minutes) return `${minutes}د ${secs}ث`;
    return `${secs}ث`;
  }

  getBookCover(book: any): string | null {
    const cover = book?.coverImage || book?.coverUrl || book?.cover;
    if (!cover) return null;
    if (/^data:|^blob:|^https?:\/\//i.test(cover)) return cover;
    return `${this.serverOrigin}${cover.startsWith('/') ? cover : `/${cover}`}`;
  }

  getAuthorName(author: any): string {
    if (!author) return 'مؤلف غير معروف';
    return typeof author === 'string' ? author : author.name || 'مؤلف غير معروف';
  }

  get total(): number { return this.books.length; }
  get available(): number { return this.books.filter(b => b.isAvailable !== false).length; }
  get views(): number { return this.books.reduce((n, b) => n + (Number(b.viewsCount) || 0), 0); }
  get downloads(): number { return this.books.reduce((n, b) => n + (Number(b.downloads) || 0), 0); }
  get authors(): number { return new Set(this.books.map(b => typeof b.author === 'string' ? b.author : b.author?.name).filter(Boolean)).size; }
  get categories(): number { return new Set(this.books.map(b => typeof b.category === 'string' ? b.category : b.category?.name).filter(Boolean)).size; }
  get recent(): Book[] {
    return [...this.books]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }
}
