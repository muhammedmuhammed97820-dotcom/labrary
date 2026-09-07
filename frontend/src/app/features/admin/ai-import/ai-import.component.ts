import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subscription, timer } from 'rxjs';

interface ImportStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string;
  url: string;
  stage: string;
  pages: number;
  discovered: number;
  normalized: number;
  imported: number;
  result: any;
}

@Component({
  selector: 'app-ai-import',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ai-import.component.html',
  styleUrl: './ai-import.component.scss'
})
export class AiImportComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private pollSubscription?: Subscription;
  private readonly api = 'http://localhost:5000';

  url = '';
  maxPages = 30;
  importNow = true;
  downloadFiles = false;
  updateExisting = false;
  externalImages = true;
  starting = false;
  message = '';
  status: ImportStatus = this.emptyStatus();

  ngOnInit(): void {
    this.refreshStatus();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  private emptyStatus(): ImportStatus {
    return {
      running: false,
      startedAt: null,
      finishedAt: null,
      error: '',
      url: '',
      stage: 'idle',
      pages: 0,
      discovered: 0,
      normalized: 0,
      imported: 0,
      result: null
    };
  }

  start(): void {
    const source = this.url.trim();
    if (!/^https?:\/\//i.test(source)) {
      this.message = 'يرجى إدخال رابط صحيح يبدأ بـ http أو https.';
      return;
    }
    if (this.starting || this.status.running) return;

    this.starting = true;
    this.message = 'جارِ تشغيل محرك الاستيراد الذكي...';
    this.status = { ...this.emptyStatus(), url: source, running: true, stage: 'starting' };

    this.http.post<any>(`${this.api}/api/import/ai/scan`, {
      url: source,
      maxPages: Math.min(Math.max(Number(this.maxPages) || 30, 1), 100),
      importNow: this.importNow,
      downloadFiles: this.downloadFiles,
      externalImages: true,
      updateExisting: this.updateExisting
    }).subscribe({
      next: response => {
        this.starting = false;
        this.message = response?.message || 'بدأت عملية الاستيراد بنجاح.';
        this.refreshStatus();
      },
      error: error => {
        this.starting = false;
        this.status = { ...this.status, running: false, error: error?.error?.message || 'تعذر بدء عملية الاستيراد.' };
        this.message = this.status.error;
        this.cdr.detectChanges();
      }
    });
  }

  refreshStatus(): void {
    this.http.get<ImportStatus>(`${this.api}/api/import/smart/status`).subscribe({
      next: status => {
        this.status = { ...this.emptyStatus(), ...(status || {}) };
        this.starting = false;
        if (this.status.running) {
          this.message = this.stageText(this.status.stage);
          this.schedulePoll(2000);
        } else if (this.status.error) {
          this.message = this.status.error;
        } else if (this.status.finishedAt) {
          this.message = `اكتملت العملية بنجاح وتمت إضافة ${this.status.imported || 0} كتاب.`;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.status.running) this.schedulePoll(5000);
      }
    });
  }

  private schedulePoll(delay: number): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = timer(delay).subscribe(() => this.refreshStatus());
  }

  stageText(stage: string): string {
    const stages: Record<string, string> = {
      starting: 'جارِ بدء العملية...',
      'ai-analyzing': 'الذكاء الاصطناعي يحلل صفحات الموقع...',
      'external-research': 'جارِ البحث عن المعلومات الناقصة من مصادر خارجية...',
      importing: 'جارِ تنظيم البيانات وإضافتها إلى المكتبة...',
      finished: 'اكتملت عملية الاستيراد.',
      error: 'حدث خطأ أثناء العملية.'
    };
    return stages[stage] || 'جارِ تحليل الموقع وجمع المعلومات...';
  }

  get progressPercent(): number {
    const max = Math.max(Number(this.maxPages) || 30, 1);
    return Math.min(100, Math.round((this.status.pages / max) * 100));
  }

  get importedBooks(): any[] {
    return Array.isArray(this.status.result?.books) ? this.status.result.books : [];
  }

  get errors(): any[] {
    return Array.isArray(this.status.result?.errors) ? this.status.result.errors : [];
  }

  reset(): void {
    this.url = '';
    this.status = this.emptyStatus();
    this.message = '';
  }
}
