import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private auth = inject(AuthService);
  menuOpen = false;

  get isAdmin(): boolean {
    const user = this.auth.currentUser;
    return user?.role === 'admin';
  }

  closeMenu() { this.menuOpen = false; }
  toggleMenu() { this.menuOpen = !this.menuOpen; }
}
