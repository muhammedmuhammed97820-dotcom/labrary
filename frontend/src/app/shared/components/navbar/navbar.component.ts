import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  menuOpen = false;

  get isAdmin(): boolean { return this.auth.isAdmin; }
  get isLoggedIn(): boolean { return this.auth.isLoggedIn; }
  get userName(): string { return this.auth.currentUser?.name || 'المستخدم'; }
  get avatar(): string | null { return this.auth.currentUser?.avatar || null; }
  get userInitial(): string { return this.userName.trim().charAt(0) || 'م'; }

  logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  closeMenu(): void { this.menuOpen = false; }
  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
}
