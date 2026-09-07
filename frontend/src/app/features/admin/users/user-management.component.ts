import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { UserManagementService, ManagedUser } from '../../../core/services/user-management.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  private readonly service = inject(UserManagementService);
  private readonly notifications = inject(NotificationService);
  readonly themeService = inject(ThemeService);

  users: ManagedUser[] = [];
  loading = true;
  saving = false;
  error = '';
  search = '';
  roleFilter = '';
  page = 1;
  readonly limit = 12;
  totalPages = 1;
  total = 0;
  stats = { totalUsers: 0, totalAdmins: 0, regularUsers: 0 };

  modalOpen = false;
  confirmOpen = false;
  userToDelete: ManagedUser | null = null;
  editing: ManagedUser | null = null;
  form = { name: '', email: '', password: '', role: 'user' as 'user' | 'admin' };

  ngOnInit(): void { this.load(); }

  load(page = this.page): void {
    this.loading = true;
    this.error = '';
    this.page = page;
    this.service.list(this.page, this.limit, this.search, this.roleFilter).subscribe({
      next: response => {
        this.users = response.users;
        this.total = response.pagination.total;
        this.totalPages = Math.max(response.pagination.totalPages, 1);
        this.stats = response.stats;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'تعذر تحميل المستخدمين.', 'error');
      }
    });
  }

  searchUsers(): void { this.page = 1; this.load(1); }
  resetFilters(): void { this.search = ''; this.roleFilter = ''; this.searchUsers(); }

  openCreate(): void {
    this.editing = null;
    this.form = { name: '', email: '', password: '', role: 'user' };
    this.error = '';
    this.modalOpen = true;
  }

  openEdit(user: ManagedUser): void {
    this.editing = user;
    this.form = { name: user.name, email: user.email, password: '', role: user.role };
    this.error = '';
    this.modalOpen = true;
  }

  closeModal(): void { if (!this.saving) this.modalOpen = false; }

  save(): void {
    if (!this.form.name.trim() || !this.form.email.trim()) { this.error = 'الاسم والبريد الإلكتروني مطلوبان.'; return; }
    if (!this.editing && this.form.password.length < 6) { this.error = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'; return; }
    if (this.editing && this.form.password && this.form.password.length < 6) { this.error = 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.'; return; }

    this.saving = true;
    this.error = '';
    const request = this.editing
      ? this.service.update(this.editing.id, { name: this.form.name, email: this.form.email, role: this.form.role, ...(this.form.password ? { password: this.form.password } : {}) })
      : this.service.create(this.form);

    request.subscribe({
      next: response => {
        this.saving = false;
        this.modalOpen = false;
        this.notifications.show(response.message, 'success');
        this.load(this.page);
      },
      error: err => {
        this.saving = false;
        this.notifications.show(err?.error?.message || 'تعذر حفظ المستخدم.', 'error');
      }
    });
  }

  deleteUser(user: ManagedUser): void {
    this.userToDelete = user;
    this.confirmOpen = true;
  }

  cancelDelete(): void {
    this.confirmOpen = false;
    this.userToDelete = null;
  }

  confirmDelete(): void {
    const user = this.userToDelete;
    if (!user) return;

    this.confirmOpen = false;
    this.userToDelete = null;
    this.service.remove(user.id).subscribe({
      next: response => {
        this.notifications.show(response.message || 'تم حذف المستخدم بنجاح.', 'success');
        if (this.users.length === 1 && this.page > 1) this.page--;
        this.load(this.page);
      },
      error: err => {
        this.notifications.show(err?.error?.message || 'تعذر حذف المستخدم.', 'error');
      }
    });
  }

  avatar(user: ManagedUser): string | null {
    if (!user.avatar) return null;
    if (/^https?:\/\//i.test(user.avatar)) return user.avatar;
    return `${environment.apiOrigin}${user.avatar.startsWith('/') ? user.avatar : '/' + user.avatar}`;
  }

  initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
}
