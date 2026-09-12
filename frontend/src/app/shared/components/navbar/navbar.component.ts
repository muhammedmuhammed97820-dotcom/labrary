import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  @Output() customize = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  menuOpen = false;

  closeMenu(): void {
    this.menuOpen = false;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  onCustomize(): void {
    this.customize.emit();
    this.closeMenu();
  }

  onThemeToggle(): void {
    this.themeToggle.emit();
  }
}
