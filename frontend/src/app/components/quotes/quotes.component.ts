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
  private readonly service = inject(CommunityService); private readonly notify = inject(NotificationService);
  readonly auth = inject(AuthService); readonly themeService = inject(ThemeService);
  quotes: Quote[] = []; filteredQuotes: Quote[] = []; search = ''; sort = 'latest'; loading = true; liking = new Set<string>();
  ngOnInit(): void { this.load(); }
  load(): void { this.loading = true; this.service.quotes().subscribe({ next: items => { this.quotes = items; this.applyFilters(); this.loading = false; }, error: e => { this.loading = false; this.notify.error(e?.error?.message || 'تعذر تحميل الاقتباسات.'); } }); }
  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    let items = term ? this.quotes.filter(q => q.text.toLowerCase().includes(term) || q.book?.title?.toLowerCase().includes(term) || q.user?.name?.toLowerCase().includes(term)) : [...this.quotes];
    if (this.sort === 'likes') items.sort((a,b) => (b.likesCount || 0) - (a.likesCount || 0)); else items.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.filteredQuotes = items;
  }
  toggleLike(q: Quote): void {
    if (!this.auth.isLoggedIn) { this.notify.warning('سجّل الدخول للإعجاب.'); return; } if (this.liking.has(q._id)) return; this.liking.add(q._id);
    this.service.toggleLike('quote', q._id).subscribe({ next: r => { q.liked = r.liked; q.likesCount = r.likesCount; this.liking.delete(q._id); }, error: e => { this.liking.delete(q._id); this.notify.error(e?.error?.message || 'تعذر تسجيل الإعجاب.'); } });
  }
  report(q: Quote): void {
    if (!this.auth.isLoggedIn) { this.notify.warning('سجّل الدخول للإبلاغ.'); return; }
    const reason = prompt('سبب البلاغ: abuse / spam / misinformation / copyright / other', 'other') || 'other'; const note = prompt('ملاحظة إضافية (اختياري):', '') || '';
    this.service.report('quote', q._id, reason, note).subscribe({ next: r => this.notify.success(r.message), error: e => this.notify.error(e?.error?.message || 'تعذر إرسال البلاغ.') });
  }
  isLiking(id: string): boolean { return this.liking.has(id); }
}
