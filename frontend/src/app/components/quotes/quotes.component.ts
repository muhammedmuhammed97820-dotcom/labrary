import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommunityService, Quote } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotes.component.html',
  styleUrl: './quotes.component.scss'
})
export class QuotesComponent implements OnInit {
  private readonly community = inject(CommunityService);
  readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  quotes: Quote[] = [];
  loading = true;
  saving = false;
  deletingId = '';
  quoteText = '';
  searchTerm = '';
  sortMode: 'latest' | 'oldest' = 'latest';
  activeFilter: 'all' | 'mine' = 'all';
  showDeleteModal = false;
  quoteToDelete: Quote | null = null;
  showReportModal = false;
  quoteToReport: Quote | null = null;
  reportReason = '';

  ngOnInit(): void {
    this.loadQuotes();
  }

  loadQuotes(): void {
    this.loading = true;
    this.community.quotes().subscribe({
      next: quotes => {
        this.quotes = (quotes ?? []).filter(q => !q.book);
        this.loading = false;
      },
      error: () => {
        this.quotes = [];
        this.loading = false;
        this.notify.show('تعذر تحميل الاقتباسات.', 'error');
      }
    });
  }

  addQuote(): void {
    if (!this.auth.isLoggedIn) {
      this.notify.show('سجّل الدخول أولًا لإضافة اقتباس.', 'error');
      return;
    }

    const text = this.quoteText.trim();
    if (!text) {
      this.notify.show('اكتب نص الاقتباس أولًا.', 'error');
      return;
    }

    if (this.saving) return;
    this.saving = true;

    // General quote: explicitly pass null because the service expects string | null.
    this.community.addQuote(null, text).subscribe({
      next: quote => {
        this.quotes = [quote, ...this.quotes.filter(q => !q.book)];
        this.quoteText = '';
        this.saving = false;
        this.notify.show('تمت إضافة الاقتباس العام ✓', 'success');
      },
      error: (err: unknown) => {
        const httpError = err as { error?: { message?: string } };
        this.saving = false;
        this.notify.show(httpError.error?.message || 'تعذر إضافة الاقتباس.', 'error');
      }
    });
  }

  filteredQuotes(): Quote[] {
    const currentUserId = String(this.auth.currentUser?._id || '');
    const term = this.searchTerm.trim().toLowerCase();

    let result = this.quotes.filter(q => {
      if (q.book) return false;
      if (this.activeFilter === 'mine' && String(q.user?._id || '') !== currentUserId) return false;
      if (!term) return true;
      return `${q.text || ''} ${q.user?.name || ''}`.toLowerCase().includes(term);
    });

    result = [...result].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return this.sortMode === 'latest' ? bTime - aTime : aTime - bTime;
    });

    return result;
  }

  openDelete(quote: Quote): void {
    this.quoteToDelete = quote;
    this.showDeleteModal = true;
  }

  closeDelete(): void {
    if (this.deletingId) return;
    this.showDeleteModal = false;
    this.quoteToDelete = null;
  }

  confirmDelete(): void {
    const id = this.quoteToDelete?._id;
    if (!id || this.deletingId) return;
    this.deletingId = String(id);
    this.community.deleteQuote(String(id)).subscribe({
      next: () => {
        this.quotes = this.quotes.filter(q => String(q._id) !== String(id));
        this.deletingId = '';
        this.closeDelete();
        this.notify.show('تم حذف الاقتباس.', 'success');
      },
      error: () => {
        this.deletingId = '';
        this.notify.show('تعذر حذف الاقتباس.', 'error');
      }
    });
  }

  openReport(quote: Quote): void {
    this.quoteToReport = quote;
    this.reportReason = '';
    this.showReportModal = true;
  }

  closeReport(): void {
    this.showReportModal = false;
    this.quoteToReport = null;
    this.reportReason = '';
  }

  submitReport(): void {
    const id = this.quoteToReport?._id;
    if (!id || !this.reportReason.trim()) {
      this.notify.show('اكتب سبب البلاغ أولًا.', 'error');
      return;
    }

    this.community.report('quote', String(id), this.reportReason.trim()).subscribe({
      next: () => {
        this.notify.show('تم إرسال البلاغ للمراجعة.', 'success');
        this.closeReport();
      },
      error: () => this.notify.show('تعذر إرسال البلاغ.', 'error')
    });
  }

  isOwner(quote: Quote): boolean {
    return !!this.auth.currentUser && String(quote.user?._id || '') === String(this.auth.currentUser?._id || '');
  }

  trackByQuote(_: number, quote: Quote): string {
    return String(quote._id);
  }
}
