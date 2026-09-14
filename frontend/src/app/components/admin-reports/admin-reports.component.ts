import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import { CommunityService, ModerationItem, ReviewResponse, CommunityComment } from '../../core/services/community.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminReportsComponent {
  private readonly service = inject(CommunityService);
  private readonly notify = inject(NotificationService);
  readonly themeService = inject(ThemeService);

  readonly items = signal<ModerationItem[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly busy = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.service.adminReports().pipe(timeout(12000)).subscribe({
      next: response => {
        this.items.set(response?.items ?? []);
        this.loading.set(false);
      },
      error: error => {
        this.items.set([]);
        this.loading.set(false);
        this.loadFailed.set(true);
        this.notify.error(error?.error?.message || 'تعذر تحميل البلاغات. تأكد من تشغيل الخادم وتسجيل الدخول بصلاحية مدير.');
      }
    });
  }

  isQuote(item: ModerationItem): boolean {
    return item.type === 'quote';
  }

  isComment(item: ModerationItem): boolean {
    return item.type === 'comment';
  }

  bookTitle(item: ModerationItem): string {
    if (this.isQuote(item)) return 'اقتباس عام';
    const comment = item as ModerationItem & { item: CommunityComment };
    const book = comment.item.book;
    return typeof book === 'object' && book ? book.title : 'غير معروف';
  }

  review(item: ModerationItem, action: 'restore' | 'reject'): void {
    const id = item.item._id;
    if (action === 'reject' && !confirm('هل تريد إخفاء هذا المحتوى نهائياً؟')) return;

    this.busy.set(id);
    const reason = action === 'reject' ? 'محتوى مخالف بعد مراجعة الإدارة' : '';

    this.service.review(item.type, id, action, reason).pipe(timeout(12000)).subscribe({
      next: (response: ReviewResponse) => {
        this.notify.success(response.message);
        this.items.update(current => current.filter(x => x !== item));
        this.busy.set('');
      },
      error: error => {
        this.busy.set('');
        this.notify.error(error?.error?.message || 'تعذر تنفيذ المراجعة');
      }
    });
  }

  reasonLabel(reason: string): string {
    return ({
      abuse: 'إساءة أو محتوى مسيء',
      spam: 'رسائل مزعجة / سبام',
      misinformation: 'معلومات مضللة',
      copyright: 'حقوق نشر',
      other: 'سبب آخر'
    } as Record<string, string>)[reason] || reason;
  }
}
