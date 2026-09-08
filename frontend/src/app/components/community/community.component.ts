import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommunityService, CommunityComment, Quote } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({ selector: 'app-community', standalone: true, imports: [CommonModule, FormsModule, RouterLink], templateUrl: './community.component.html', styleUrl: './community.component.scss' })
export class CommunityComponent implements OnInit {
  private readonly route = inject(ActivatedRoute); private readonly service = inject(CommunityService); private readonly notify = inject(NotificationService); readonly auth = inject(AuthService);
  bookId = ''; quotes: Quote[] = []; comments: CommunityComment[] = []; quoteText = ''; quotePage: number | null = null; commentText = ''; replyTo = ''; loading = true; saving = false;
  ngOnInit() { this.bookId = this.route.snapshot.paramMap.get('id') || ''; this.load(); }
  load() { this.loading = true; this.service.quotes(this.bookId).subscribe({ next: q => { this.quotes = q; this.service.comments(this.bookId).subscribe({ next: c => { this.comments = c; this.loading = false; }, error: e => { this.loading = false; this.notify.error(e?.error?.message || 'تعذر تحميل التعليقات'); } }); }, error: e => { this.loading = false; this.notify.error(e?.error?.message || 'تعذر تحميل الاقتباسات'); } }); }
  addQuote() { if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول لإضافة اقتباس.'); if (!this.quoteText.trim()) return this.notify.warning('اكتب نص الاقتباس.'); this.saving = true; this.service.addQuote({ book: this.bookId, text: this.quoteText.trim(), page: this.quotePage }).subscribe({ next: q => { this.quotes = [q, ...this.quotes]; this.quoteText = ''; this.quotePage = null; this.saving = false; this.notify.success('تمت إضافة الاقتباس.'); }, error: e => { this.saving = false; this.notify.error(e?.error?.message || 'تعذر إضافة الاقتباس.'); } }); }
  addComment() { if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول لإضافة تعليق.'); if (!this.commentText.trim()) return this.notify.warning('اكتب التعليق.'); this.saving = true; this.service.addComment({ book: this.bookId, text: this.commentText.trim(), parent: this.replyTo || null }).subscribe({ next: c => { this.comments = [...this.comments, c]; this.commentText = ''; this.replyTo = ''; this.saving = false; this.notify.success('تمت إضافة التعليق.'); }, error: e => { this.saving = false; this.notify.error(e?.error?.message || 'تعذر إضافة التعليق.'); } }); }
  reply(c: CommunityComment) { this.replyTo = c._id; }
  report(type: 'quote' | 'comment', id: string) { if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول للإبلاغ.'); const reason = prompt('سبب البلاغ: abuse / spam / misinformation / copyright / other', 'other') || 'other'; const note = prompt('ملاحظة إضافية (اختياري):', '') || ''; this.service.report(type, id, reason, note).subscribe({ next: r => this.notify.success(r.message), error: e => this.notify.error(e?.error?.message || 'تعذر إرسال البلاغ.') }); }
}
