import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommunityService, Quote } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-quotes', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quotes.component.html', styleUrl: './quotes.component.scss'
})
export class QuotesComponent implements OnInit {
  private readonly service = inject(CommunityService);
  private readonly notify = inject(NotificationService);
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  quotes: Quote[] = [];
  filteredQuotes: Quote[] = [];
  search = '';
  sort = 'latest';
  loading = true;
  saving = false;
  showComposer = false;
  editingId = '';
  quoteText = '';
  liking = new Set<string>();

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.service.quotes().subscribe({
      next: items => { this.quotes = items; this.applyFilters(); this.loading = false; },
      error: e => { this.loading = false; this.notify.error(e?.error?.message || 'تعذر تحميل الاقتباسات.'); }
    });
  }

  openComposer(): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول لإضافة اقتباس.');
    this.editingId = '';
    this.quoteText = '';
    this.showComposer = true;
  }

  startEdit(q: Quote): void {
    if (!this.isOwner(q)) return this.notify.error('لا يمكنك تعديل اقتباس مستخدم آخر.');
    this.editingId = q._id;
    this.quoteText = q.text;
    this.showComposer = true;
  }

  cancelComposer(): void {
    if (this.saving) return;
    this.showComposer = false;
    this.editingId = '';
    this.quoteText = '';
  }

  saveQuote(): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول أولاً.');
    const text = this.quoteText.trim();
    if (!text) return this.notify.warning('اكتب نص الاقتباس.');
    if (text.length < 3) return this.notify.warning('نص الاقتباس قصير جدًا.');
    this.saving = true;
    const editing = this.editingId;
    const request = editing ? this.service.updateQuote(editing, text) : this.service.addQuote(text);
    request.subscribe({
      next: quote => {
        if (editing) this.quotes = this.quotes.map(q => q._id === quote._id ? quote : q);
        else this.quotes = [quote, ...this.quotes];
        this.applyFilters();
        this.saving = false;
        this.notify.success(editing ? 'تم تعديل الاقتباس.' : 'تم نشر الاقتباس.');
        this.cancelComposer();
      },
      error: e => { this.saving = false; this.notify.error(e?.error?.message || 'تعذر حفظ الاقتباس.'); }
    });
  }

  deleteQuote(q: Quote): void {
    if (!this.isOwner(q)) return this.notify.error('لا يمكنك حذف اقتباس مستخدم آخر.');
    if (!confirm('هل تريد حذف هذا الاقتباس نهائيًا؟')) return;
    this.service.deleteQuote(q._id).subscribe({
      next: r => { this.quotes = this.quotes.filter(item => item._id !== q._id); this.applyFilters(); this.notify.success(r.message); },
      error: e => this.notify.error(e?.error?.message || 'تعذر حذف الاقتباس.')
    });
  }

  isOwner(q: Quote): boolean {
    const current = this.auth.user();
    const currentId = current?._id || current?.id;
    return !!currentId && String(currentId) === String(q.user?._id);
  }

  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    let items = term ? this.quotes.filter(q => q.text.toLowerCase().includes(term) || q.user?.name?.toLowerCase().includes(term)) : [...this.quotes];
    if (this.sort === 'likes') items.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    else items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.filteredQuotes = items;
  }

  toggleLike(q: Quote): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول للإعجاب.');
    if (this.liking.has(q._id)) return;
    this.liking.add(q._id);
    this.service.toggleLike('quote', q._id).subscribe({
      next: result => { q.liked = result.liked; q.likesCount = result.likesCount; this.liking.delete(q._id); },
      error: e => { this.liking.delete(q._id); this.notify.error(e?.error?.message || 'تعذر تسجيل الإعجاب.'); }
    });
  }

  report(q: Quote): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول للإبلاغ.');
    const reason = prompt('سبب البلاغ: abuse / spam / misinformation / copyright / other', 'other') || 'other';
    const note = prompt('ملاحظة إضافية (اختياري):', '') || '';
    this.service.report('quote', q._id, reason, note).subscribe({
      next: r => this.notify.success(r.message), error: e => this.notify.error(e?.error?.message || 'تعذر إرسال البلاغ.')
    });
  }

  isLiking(id: string): boolean { return this.liking.has(id); }
}
