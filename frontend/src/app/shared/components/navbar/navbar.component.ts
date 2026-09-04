import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  public readonly themeService = inject(ThemeService);
  private readonly serverOrigin = 'http://localhost:5000';
  
  menuOpen = false;

  get isAdmin(): boolean { return this.auth.isAdmin; }
  get isLoggedIn(): boolean { return this.auth.isLoggedIn; }
  get userName(): string { return this.auth.currentUser?.name || 'المستخدم'; }

  get avatar(): string | null {
    const value = this.auth.currentUser?.avatar;
    if (!value) return null;
    if (/^data:|^blob:|^https?:\/\//i.test(value)) return value;
    return `${this.serverOrigin}${value.startsWith('/') ? value : `/${value}`}`;
  }

  get userInitial(): string { return this.userName.trim().charAt(0) || 'م'; }
  
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void { 
    this.auth.logout(); 
    this.closeMenu(); 
    this.router.navigate(['/login']); 
  }

  closeMenu(): void { this.menuOpen = false; }
  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
}