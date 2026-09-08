import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Book, BookApiService } from '../../../core/services/book-api.service';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService } from '../../../core/services/notification.service';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';

@Component({
  selector: 'app-book-reader',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './book-reader.component.html',
  styleUrl: './book-reader.component.scss'
})
export class BookReaderComponent implements OnInit, OnDestroy {
  @ViewChild('readerViewport') readerViewport?: ElementRef<HTMLElement>;
  @ViewChild('pageCanvas') pageCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  private readonly route = inject(ActivatedRoute);
  readonly api = inject(BookApiService);
  private readonly notify = inject(NotificationService);
  readonly themeService = inject(ThemeService);

  book: Book | null = null;
  pdf: any = null;
  page = 1;
  totalPages = 0;
  zoom = 1;
  rotation = 0;
  fitMode: 'width' | 'page' | 'manual' = 'width';
  loading = true;
  rendering = false;
  error = '';
  sidebarOpen = false;
  settingsOpen = false;
  searchOpen = false;
  fullscreen = false;
  showToolbar = true;
  bookmarks: number[] = [];
  searchTerm = '';
  searchResults: { page: number; snippet: string }[] = [];
  searchBusy = false;
  searchIndex: { page: number; text: string }[] = [];
  currentSearchIndex = 0;
  pageInput = '1';
  private hideTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private renderQueue: Promise<void> = Promise.resolve();
  private renderGeneration = 0;

  readonly zoomSteps = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  authorName(): string {
    const author = this.book?.author;
    return !author ? 'المكتبة الإلكترونية' : typeof author === 'string' ? author : author.name || 'مؤلف غير محدد';
  }

  async ngOnInit(): Promise<void> {
    this.loadBookmarks();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'معرّف الكتاب غير موجود.';
      this.loading = false;
      return;
    }

    try {
      this.book = await this.api.getById(id).toPromise() as Book;
      if (!this.book?.filePath) throw new Error('ملف الكتاب غير متوفر.');

      const savedPage = Number(localStorage.getItem(this.progressKey())) || 1;
      this.page = Math.max(1, savedPage);
      this.pageInput = String(this.page);

      await this.openPdf(this.api.getReaderUrl(id));
    } catch (error) {
      console.error('Reader loading error:', error);
      this.error = this.getReaderError(error);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.renderGeneration++;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    try { this.pdf?.destroy?.(); } catch { /* noop */ }
  }

  private getReaderError(error: any): string {
    const status = Number(error?.status || 0);
    if (status === 404) return 'ملف الكتاب غير موجود على الخادم.';
    if (status === 415) return 'هذا الكتاب ليس PDF. القارئ الحالي يدعم ملفات PDF فقط.';
    if (status === 0) return 'تعذر الاتصال بخادم المكتبة. تأكد من تشغيل الخادم بنجاح.';
    return 'تعذر فتح الكتاب. تأكد أن ملف PDF متوفر ثم حاول مرة أخرى.';
  }

  private async openPdf(url: string): Promise<void> {
    const loadingTask = pdfjsLib.getDocument({
      url,
      cMapUrl: 'assets/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'assets/pdfjs/standard_fonts/',
      wasmUrl: 'assets/pdfjs/wasm/',
      useSystemFonts: true,
      disableFontFace: false,
    });

    this.pdf = await loadingTask.promise;
    if (this.destroyed) return;
    this.totalPages = this.pdf.numPages;
    this.page = Math.min(this.page, this.totalPages);
    this.pageInput = String(this.page);
    this.loading = false;

    setTimeout(async () => {
      if (!this.destroyed) await this.renderPage();
    }, 50);
  }

  async renderPage(): Promise<void> {
    const generation = ++this.renderGeneration;
    this.renderQueue = this.renderQueue.then(() => this.renderPageInternal(generation)).catch(error => {
      if (!this.destroyed) console.warn('PDF page render warning:', error);
    });
    return this.renderQueue;
  }

  private async renderPageInternal(generation: number): Promise<void> {
    if (!this.pdf || !this.pageCanvas || this.destroyed || generation !== this.renderGeneration) return;
    this.rendering = true;
    try {
      const pdfPage = await this.pdf.getPage(this.page);
      if (this.destroyed || generation !== this.renderGeneration) return;

      const canvas = this.pageCanvas.nativeElement;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      let clientWidth = this.readerViewport?.nativeElement.clientWidth || 0;
      if (clientWidth < 100) {
        await new Promise(resolve => setTimeout(resolve, 60));
        clientWidth = this.readerViewport?.nativeElement.clientWidth || 800;
      }
      if (this.destroyed || generation !== this.renderGeneration) return;

      let scale = this.zoom;
      const viewportAtOne = pdfPage.getViewport({ scale: 1, rotation: this.rotation });

      if (this.fitMode === 'width' && this.readerViewport) {
        const available = Math.max(320, clientWidth - 48);
        scale = Math.max(0.2, available / viewportAtOne.width);
      } else if (this.fitMode === 'page' && this.readerViewport) {
        const box = this.readerViewport.nativeElement;
        const availableWidth = Math.max(320, clientWidth - 48);
        const availableHeight = Math.max(420, box.clientHeight - 48);
        scale = Math.min(availableWidth / viewportAtOne.width, availableHeight / viewportAtOne.height);
      }

      const viewport = pdfPage.getViewport({ scale, rotation: this.rotation });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, viewport.width, viewport.height);

      if (this.destroyed || generation !== this.renderGeneration) return;
      await pdfPage.render({ canvasContext: context, viewport }).promise;
      if (this.destroyed || generation !== this.renderGeneration) return;
      this.saveProgress();
    } finally {
      this.rendering = false;
    }
  }

  async nextPage(): Promise<void> {
    if (this.page >= this.totalPages) return;
    this.page++;
    this.pageInput = String(this.page);
    await this.renderPage();
    this.scrollReaderTop();
  }

  async previousPage(): Promise<void> {
    if (this.page <= 1) return;
    this.page--;
    this.pageInput = String(this.page);
    await this.renderPage();
    this.scrollReaderTop();
  }

  async goToPage(): Promise<void> {
    const value = Number(this.pageInput);
    if (!Number.isFinite(value)) {
      this.pageInput = String(this.page);
      return;
    }
    this.page = Math.min(this.totalPages, Math.max(1, Math.floor(value)));
    this.pageInput = String(this.page);
    await this.renderPage();
    this.scrollReaderTop();
  }

  async zoomIn(): Promise<void> {
    const next = this.zoomSteps.find(value => value > this.zoom + 0.001);
    this.zoom = next ?? 3;
    this.fitMode = 'manual';
    await this.renderPage();
  }

  async zoomOut(): Promise<void> {
    const previous = [...this.zoomSteps].reverse().find(value => value < this.zoom - 0.001);
    this.zoom = previous ?? 0.75;
    this.fitMode = 'manual';
    await this.renderPage();
  }

  async setFit(mode: 'width' | 'page' | 'manual'): Promise<void> {
    this.fitMode = mode;
    await this.renderPage();
  }

  async rotate(): Promise<void> {
    this.rotation = (this.rotation + 90) % 360;
    await this.renderPage();
  }

  toggleBookmark(): void {
    if (this.bookmarks.includes(this.page)) {
      this.bookmarks = this.bookmarks.filter(page => page !== this.page);
      this.notify.show('تمت إزالة العلامة المرجعية.', 'success');
    } else {
      this.bookmarks = [...this.bookmarks, this.page].sort((a, b) => a - b);
      this.notify.show('تم حفظ العلامة المرجعية بنجاح.', 'success');
    }
    localStorage.setItem(this.bookmarkKey(), JSON.stringify(this.bookmarks));
  }

  isBookmarked(): boolean { return this.bookmarks.includes(this.page); }

  openBookmark(page: number): void {
    this.page = page;
    this.pageInput = String(page);
    this.renderPage();
    this.sidebarOpen = false;
    this.scrollReaderTop();
  }

  private normalizeArabic(value: string): string {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ـ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('ar');
  }

  private getTextForSearch(items: any[]): string {
    return items
      .map(item => String(item?.str || '').replace(/[\r\n\t]+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async search(): Promise<void> {
    const term = this.normalizeArabic(this.searchTerm);
    if (!term || !this.pdf) {
      this.searchResults = [];
      return;
    }

    this.searchBusy = true;
    try {
      if (!this.searchIndex.length) {
        for (let page = 1; page <= this.totalPages; page++) {
          if (this.destroyed) return;
          const pdfPage = await this.pdf.getPage(page);
          const content = await pdfPage.getTextContent();
          const text = this.getTextForSearch(content.items as any[]);
          this.searchIndex.push({ page, text });
        }
      }

      this.searchResults = this.searchIndex
        .map(item => ({ ...item, normalized: this.normalizeArabic(item.text) }))
        .filter(item => item.normalized.includes(term))
        .slice(0, 80)
        .map(item => {
          const normalized = item.normalized;
          const index = normalized.indexOf(term);
          const original = item.text;
          const start = Math.max(0, index - 55);
          const end = Math.min(original.length, index + term.length + 95);
          return { page: item.page, snippet: original.slice(start, end).trim() };
        });

      this.currentSearchIndex = 0;
    } finally {
      this.searchBusy = false;
    }
  }

  jumpToSearchResult(result: { page: number }): void {
    this.page = result.page;
    this.pageInput = String(result.page);
    this.renderPage();
    this.searchOpen = false;
    this.scrollReaderTop();
  }

  async toggleFullscreen(): Promise<void> {
    const element = this.readerViewport?.nativeElement.closest('.reader-shell') as HTMLElement | null;
    if (!document.fullscreenElement && element) {
      await element.requestFullscreen?.();
      this.fullscreen = true;
    } else {
      await document.exitFullscreen?.();
      this.fullscreen = false;
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void { this.fullscreen = !!document.fullscreenElement; }

  @HostListener('document:keydown', ['$event'])
  async onKeydown(event: KeyboardEvent): Promise<void> {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    switch (event.key) {
      case 'ArrowLeft': case 'PageDown': event.preventDefault(); await this.nextPage(); break;
      case 'ArrowRight': case 'PageUp': event.preventDefault(); await this.previousPage(); break;
      case '+': case '=': event.preventDefault(); await this.zoomIn(); break;
      case '-': event.preventDefault(); await this.zoomOut(); break;
      case 'f': case 'F': if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); await this.toggleFullscreen(); } break;
      case 'b': case 'B': event.preventDefault(); this.toggleBookmark(); break;
      case '/': event.preventDefault(); this.searchOpen = true; setTimeout(() => this.searchInput?.nativeElement.focus()); break;
      case 'Escape': this.searchOpen = false; this.settingsOpen = false; this.sidebarOpen = false; break;
    }
    this.keepToolbarVisible();
  }

  onPointerActivity(): void { this.keepToolbarVisible(); }

  private keepToolbarVisible(): void {
    this.showToolbar = true;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    if (this.fullscreen) this.hideTimer = setTimeout(() => this.showToolbar = false, 3200);
  }

  private scrollReaderTop(): void {
    requestAnimationFrame(() => this.readerViewport?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  private progressKey(): string { return `electronic_library_reader_progress_${this.book?._id || this.route.snapshot.paramMap.get('id')}`; }
  private bookmarkKey(): string { return `electronic_library_reader_bookmarks_${this.book?._id || this.route.snapshot.paramMap.get('id')}`; }
  private saveProgress(): void { localStorage.setItem(this.progressKey(), String(this.page)); }

  private loadBookmarks(): void {
    try {
      const value = JSON.parse(localStorage.getItem(this.bookmarkKey()) || '[]');
      this.bookmarks = Array.isArray(value) ? value.filter((page: unknown) => Number.isInteger(page)) : [];
    } catch { this.bookmarks = []; }
  }
}