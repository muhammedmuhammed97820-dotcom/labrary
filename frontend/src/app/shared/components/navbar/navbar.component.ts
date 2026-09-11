import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService, ColorPalette } from '../../../core/services/theme.service';

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
  public readonly themeService = inject(ThemeService);

  menuOpen = signal<boolean>(false);
  showPanel = signal<boolean>(false);

  get isAdmin(): boolean { return this.auth.isAdmin; }
  get isLoggedIn(): boolean { return this.auth.isLoggedIn; }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  togglePanel(): void {
    this.showPanel.update(v => !v);
  }

  onColorChange(event: Event, key: keyof ColorPalette): void {
    const value = (event.target as HTMLInputElement).value;
    this.themeService.updatePalette({ [key]: value });
  }

  logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  closeMenu(): void { this.menuOpen.set(false); }
  toggleMenu(): void { this.menuOpen.update(v => !v); }
}