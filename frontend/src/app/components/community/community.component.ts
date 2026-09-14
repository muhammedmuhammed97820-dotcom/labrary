import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import { CommunityService, CommunityComment, Quote } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(CommunityService);
  private readonly notify = inject(NotificationService);
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);

  bookId = '';
  quotes: Quote[] = [];
  comments: CommunityComment[] = [];
  quoteText = '';
  commentText = '';
  replyTo = '';
  loading = true;
  loadFailed = false;
  loadError = '';
  saving = false;
  liking = new Set<string>();

  constructor() {
    this.bookId = this.route.snapshot.paramMap.get('id') || '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.loadError = '';

    if (!this.bookId) {
      this.loading = false;
      this.loadFailed = true;
      this.loadError = 'معرّف الكتاب غير موجود.';
      return;
    }

    this.service.quotes(this.bookId).pipe(timeout(12000)).subscribe({
      next: quotes => {
        this.quotes = quotes ?? [];
        this.loadComments();
      },
      error: error => this.failLoading(error, 'تعذر تحميل اقتباسات هذا الكتاب.')
    });
  }

  private loadComments(): void {
    this.service.comments(this.bookId).pipe(timeout(12000)).subscribe({
      next: comments => {
        this.comments = comments ?? [];
        this.loading = false;
      },
      error: error => this.failLoading(error, 'تعذر تحميل تعليقات هذا الكتاب.')
    });
  }

  private failLoading(error: any, fallback: string): void {
    this.loading = false;
    this.loadFailed = true;
    this.loadError = error?.error?.message || fallback;
    this.notify.error(this.loadError);
  }

  addQuote(): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول لإضافة اقتباس.');
    if (!this.quoteText.trim()) return this.notify.warning('اكتب نص الاقتباس.');
    this.saving = true;
    this.service.addQuote(this.bookId, this.quoteText.trim()).pipe(timeout(12000)).subscribe({
      next: quote => {
        this.quotes = [quote, ...this.quotes];
        this.quoteText = '';
        this.saving = false;
        this.notify.success('تمت إضافة الاقتباس لهذا الكتاب.');
      },
      error: error => {
        this.saving = false;
        this.notify.error(error?.error?.message || 'تعذر إضافة الاقتباس.');
      }
    });
  }

  addComment(): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول لإضافة تعليق.');
    if (!this.commentText.trim()) return this.notify.warning('اكتب التعليق.');
    this.saving = true;
    this.service.addComment({ book: this.bookId, text: this.commentText.trim(), parent: this.replyTo || null }).pipe(timeout(12000)).subscribe({
      next: comment => {
        this.comments = [...this.comments, comment];
        this.commentText = '';
        this.replyTo = '';
        this.saving = false;
        this.notify.success('تمت إضافة التعليق.');
      },
      error: error => {
        this.saving = false;
        this.notify.error(error?.error?.message || 'تعذر إضافة التعليق.');
      }
    });
  }

  toggleLike(type: 'quote' | 'comment', item: Quote | CommunityComment): void {
    if (!this.auth.isLoggedIn) {
      this.notify.warning('سجّل الدخول للإعجاب.');
      return;
    }
    const key = `${type}:${item._id}`;
    if (this.liking.has(key)) return;
    this.liking.add(key);
    this.service.toggleLike(type, item._id).pipe(timeout(12000)).subscribe({
      next: result => {
        item.liked = result.liked;
        item.likesCount = result.likesCount;
        this.liking.delete(key);
      },
      error: error => {
        this.liking.delete(key);
        this.notify.error(error?.error?.message || 'تعذر تسجيل الإعجاب.');
      }
    });
  }

  isLiking(type: 'quote' | 'comment', id: string): boolean {
    return this.liking.has(`${type}:${id}`);
  }

  reply(comment: CommunityComment): void {
    this.replyTo = comment._id;
  }

  report(type: 'quote' | 'comment', id: string): void {
    if (!this.auth.isLoggedIn) return this.notify.warning('سجّل الدخول للإبلاغ.');
    const reason = prompt('سبب البلاغ: abuse / spam / misinformation / copyright / other', 'other') || 'other';
    const note = prompt('ملاحظة إضافية (اختياري):', '') || '';
    this.service.report(type, id, reason, note).pipe(timeout(12000)).subscribe({
      next: response => this.notify.success(response.message),
      error: error => this.notify.error(error?.error?.message || 'تعذر إرسال البلاغ.')
    });
  }
}
