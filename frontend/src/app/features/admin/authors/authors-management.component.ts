import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BookApiService } from '../../../core/services/book-api.service';

@Component({
  selector: 'app-authors-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './authors-management.component.html',
  styleUrl: './authors-management.component.scss'
})
export class AuthorsManagementComponent implements OnInit {
  private readonly http = inject(HttpClient);
  public readonly themeService = inject(ThemeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly media = inject(BookApiService);

  authors: any[] = [];
  author: any = {};
  editing: any = null;
  file: File | null = null;
  preview = '';
  loading = true;
  saving = false;
  error = '';
  deletingId: string | null = null;

  private readonly api = `${this.media.getFileUrl('/api')}/authors`;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<any[]>(this.api).subscribe({
      next: (v) => {
        this.authors = v;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Authors load error:', e);
        this.error = 'تعذر تحميل قائمة المؤلفين.';
        this.loading = false;
        this.notify.show(this.error, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  newAuthor(): void {
    this.editing = null;
    this.author = {};
    this.file = null;
    this.preview = '';
    this.deletingId = null;
  }

  edit(a: any): void {
    this.editing = a;
    this.author = {
      ...a,
      birthDate: a.birthDate?.slice?.(0, 10),
      deathDate: a.deathDate?.slice?.(0, 10)
    };
    this.preview = a.image ? this.url(a.image) : '';
    this.deletingId = null;
  }

  pick(e: any): void {
    this.file = e.target.files?.[0] || null;
    if (this.file) {
      const r = new FileReader();
      r.onload = () => {
        this.preview = String(r.result);
        this.cdr.detectChanges();
      };
      r.readAsDataURL(this.file);
    }
  }

  save(): void {
    this.saving = true;
    const f = new FormData();
    for (const k of ['name', 'bio', 'birthDate', 'deathDate', 'birthPlace', 'nationality', 'occupation', 'website']) {
      if (this.author[k] != null) f.append(k, this.author[k]);
    }
    if (this.file) f.append('avatar', this.file);

    const r = this.editing
      ? this.http.put(`${this.api}/${this.editing._id}`, f)
      : this.http.post(this.api, f);

    r.subscribe({
      next: () => {
        this.notify.show(this.editing ? 'تم تحديث بيانات المؤلف بنجاح ✓' : 'تم إضافة المؤلف بنجاح ✓', 'success');
        this.newAuthor();
        this.load();
        this.saving = false;
      },
      error: (e) => {
        const msg = e?.error?.message || 'فشل حفظ بيانات المؤلف.';
        this.notify.show(msg, 'error');
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  promptDelete(a: any): void {
    const id = a._id;
    if (this.deletingId === id) {
      this.http.delete(`${this.api}/${id}`).subscribe({
        next: () => {
          this.notify.show('تم حذف المؤلف بنجاح ✓', 'success');
          this.deletingId = null;
          this.load();
        },
        error: (e) => {
          this.notify.show(e?.error?.message || 'تعذر حذف المؤلف.', 'error');
          this.deletingId = null;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.deletingId = id;
    }
  }

  cancelDelete(): void {
    this.deletingId = null;
  }

  url(v?: string | null): string {
    return this.media.getAuthorImageUrl(v);
  }
}
