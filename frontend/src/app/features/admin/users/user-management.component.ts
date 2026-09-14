import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { UserManagementService, ManagedUser } from '../../../core/services/user-management.service';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  private readonly service = inject(UserManagementService);
  readonly themeService = inject(ThemeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  users: ManagedUser[] = [];
  loading = true;
  saving = false;
  deletingId: string | null = null;
  search = '';
  roleFilter = '';
  page = 1;
  readonly limit = 12;
  totalPages = 1;
  total = 0;
  stats = { totalUsers: 0, totalAdmins: 0, regularUsers: 0 };

  modalOpen = false;
  editing: ManagedUser | null = null;
  form = { name: '', email: '', password: '', role: 'user' as 'user' | 'admin' };

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page): void {
    this.loading = true;
    this.page = page;

    this.service.list(this.page, this.limit, this.search, this.roleFilter).subscribe({
      next: response => {
        this.loading = false;
        const users = Array.isArray(response?.users) ? response.users : [];
        const pagination = response?.pagination;
        const stats = response?.stats;

        this.users = users;
        this.total = pagination?.total ?? users.length;
        this.totalPages = Math.max(pagination?.totalPages ?? 1, 1);
        this.stats = stats ?? {
          totalUsers: this.total,
          totalAdmins: users.filter(user => user.role === 'admin').length,
          regularUsers: users.filter(user => user.role !== 'admin').length
        };

        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.notify.error(err?.error?.message || 'تعذر تحميل المستخدمين.');
        this.cdr.markForCheck();
      }
    });
  }

  searchUsers(): void {
    this.page = 1;
    this.load(1);
  }

  resetFilters(): void {
    this.search = '';
    this.roleFilter = '';
    this.searchUsers();
  }

  openCreate(): void {
    this.editing = null;
    this.form = { name: '', email: '', password: '', role: 'user' };
    this.modalOpen = true;
  }

  openEdit(user: ManagedUser): void {
    this.editing = user;
    this.form = { name: user.name, email: user.email, password: '', role: user.role };
    this.modalOpen = true;
  }

  closeModal(): void {
    if (!this.saving) this.modalOpen = false;
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.email.trim()) {
      this.notify.warning('الاسم والبريد الإلكتروني مطلوبان.');
      return;
    }
    if (!this.editing && this.form.password.length < 6) {
      this.notify.warning('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (this.editing && this.form.password && this.form.password.length < 6) {
      this.notify.warning('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    this.saving = true;
    const request = this.editing
      ? this.service.update(this.editing.id, {
          name: this.form.name,
          email: this.form.email,
          role: this.form.role,
          ...(this.form.password ? { password: this.form.password } : {})
        })
      : this.service.create(this.form);

    request.subscribe({
      next: response => {
        this.saving = false;
        this.modalOpen = false;
        this.notify.success(response.message || (this.editing ? 'تم تحديث المستخدم بنجاح.' : 'تم إنشاء المستخدم بنجاح.'));
        this.load(this.page);
      },
      error: err => {
        this.saving = false;
        this.notify.error(err?.error?.message || 'تعذر حفظ المستخدم.');
        this.cdr.markForCheck();
      }
    });
  }

  deleteUser(user: ManagedUser): void {
    if (this.deletingId) return;

    const confirmed = confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟ لا يمكن التراجع عن هذه العملية.`);
    if (!confirmed) return;

    this.deletingId = user.id;
    this.service.remove(user.id).subscribe({
      next: response => {
        this.deletingId = null;
        this.notify.success(response.message || `تم حذف المستخدم "${user.name}" بنجاح.`);
        if (this.users.length === 1 && this.page > 1) this.page--;
        this.load(this.page);
      },
      error: err => {
        this.deletingId = null;
        this.notify.error(err?.error?.message || 'تعذر حذف المستخدم.');
        this.cdr.markForCheck();
      }
    });
  }

  avatar(user: ManagedUser): string | null {
    if (!user.avatar) return null;
    if (/^https?:\/\//i.test(user.avatar)) return user.avatar;
    return `${environment.apiOrigin}${user.avatar.startsWith('/') ? user.avatar : '/' + user.avatar}`;
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  }
}
