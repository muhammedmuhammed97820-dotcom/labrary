import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-categories-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './categories-management.component.html',
  styleUrl: './categories-management.component.scss'
})
export class CategoriesManagementComponent implements OnInit {
  private readonly http = inject(HttpClient);
  public readonly themeService = inject(ThemeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  categories: any[] = [];
  category: any = {};
  editing: any = null;
  loading = true;
  saving = false;
  error = '';
  deletingId: string | null = null;
  
  private readonly api = 'http://localhost:5000/api/categories';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<any[]>(this.api).subscribe({
      next: (v) => {
        this.categories = v;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Categories load error:', e);
        this.error = 'تعذر تحميل التصنيفات.';
        this.loading = false;
        this.notify.show(this.error, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  newCategory(): void {
    this.editing = null;
    this.category = {};
    this.deletingId = null;
    this.cdr.detectChanges();
  }

  edit(c: any): void {
    this.editing = c;
    this.category = { ...c };
    this.deletingId = null;
    this.cdr.detectChanges();
  }

  save(): void {
    this.saving = true;
    const r = this.editing 
      ? this.http.put(`${this.api}/${this.editing._id}`, this.category) 
      : this.http.post(this.api, this.category);

    r.pipe(
      finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.notify.show(this.editing ? 'تم تحديث التصنيف بنجاح ✓' : 'تم إضافة التصنيف بنجاح ✓', 'success');
        this.newCategory();
        this.load();
      },
      error: (e) => {
        const msg = e?.error?.message || 'فشل حفظ التصنيف.';
        this.notify.show(msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  promptDelete(c: any): void {
    const id = c._id;
    if (this.deletingId === id) {
      this.http.delete(`${this.api}/${id}`).subscribe({
        next: () => {
          this.notify.show('تم حذف التصنيف بنجاح ✓', 'success');
          this.deletingId = null;
          this.load();
        },
        error: (e) => {
          this.notify.show(e?.error?.message || 'تعذر حذف التصنيف.', 'error');
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
}