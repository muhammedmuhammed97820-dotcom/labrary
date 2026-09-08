import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommunityService, ModerationItem, ReviewResponse, Quote, CommunityComment } from '../../core/services/community.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss'
})
export class AdminReportsComponent implements OnInit {
  private readonly service = inject(CommunityService);
  private readonly notify = inject(NotificationService);

  items: ModerationItem[] = [];
  loading = true;
  busy = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.service.adminReports().subscribe({
      next: response => { this.items = response.items ?? []; this.loading = false; },
      error: error => { this.loading = false; this.notify.error(error?.error?.message || 'تعذر تحميل البلاغات'); }
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
    this.busy = id;
    const reason = action === 'reject' ? 'محتوى مخالف بعد مراجعة الإدارة' : '';
    this.service.review(item.type, id, action, reason).subscribe({
      next: (response: ReviewResponse) => {
        this.notify.success(response.message);
        this.items = this.items.filter(x => x !== item);
        this.busy = '';
      },
      error: error => {
        this.busy = '';
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
