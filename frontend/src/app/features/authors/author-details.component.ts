import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { BookApiService } from '../../core/services/book-api.service';

@Component({
  selector: 'app-author-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './author-details.component.html',
  styleUrl: './author-details.component.scss'
})
export class AuthorDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly notify = inject(NotificationService);
  private readonly api = inject(BookApiService);

  readonly themeService = inject(ThemeService);

  authorId = '';
  author: any = null;
  loading = true;
  error = '';

  ngOnInit(): void {
    this.authorId = this.route.snapshot.paramMap.get('id') ?? '';

    if (!this.authorId) {
      this.error = 'معرّف المؤلف غير موجود.';
      this.loading = false;
      return;
    }

    this.loadAuthorDetails();
  }

  private loadAuthorDetails(): void {
    this.http
      .get<any>(
        `${this.api.getFileUrl('/api')}/authors/${this.authorId}`
      )
      .subscribe({
        next: data => {
          this.author = data;
          this.loading = false;
          this.cdr.detectChanges();
        },

        error: (err: unknown) => {
          const httpError = err as {
            error?: {
              message?: string;
            };
          };

          this.error =
            httpError.error?.message ||
            'تعذر تحميل تفاصيل المؤلف.';

          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * رابط صورة المؤلف الشخصية
   */
  imageUrl(value?: string | null): string {
    return this.api.getFileUrl(value);
  }

  /**
   * رابط غلاف الكتاب.
   *
   * ندعم رابط الغلاف الجاهز، كما ندعم coverImageId
   * الذي قد يرجعه API الخاص بتفاصيل المؤلف.
   */
  bookCoverUrl(book: any): string {
    if (!book) {
      return 'assets/images/default-cover.svg';
    }

    const coverPath =
      book.coverImage ||
      book.coverUrl ||
      book.cover ||
      book.image;

    if (coverPath) {
      return this.api.getFileUrl(coverPath);
    }

    const bookId = String(book._id || book.id || '').trim();

    if (bookId && book.coverImageId) {
      return `${this.api.getFileUrl('/api')}/books/${bookId}/cover`;
    }

    return 'assets/images/default-cover.svg';
  }
}
