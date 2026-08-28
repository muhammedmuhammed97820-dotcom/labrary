import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  menuOpen = false;

  get isAdmin(): boolean { return this.auth.isAdmin; }
  get isLoggedIn(): boolean { return this.auth.isLoggedIn; }
  get userName(): string { return this.auth.currentUser?.name || 'المستخدم'; }

  get avatar(): string | null {
    const value = this.auth.currentUser?.avatar;
    if (!value) return null;
    return /^data:|^blob:|^https?:\/\//i.test(value) ? value : `${environment.apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
  }

  get userInitial(): string { return this.userName.trim().charAt(0) || 'م'; }

  logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  closeMenu(): void { this.menuOpen = false; }
  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
}
