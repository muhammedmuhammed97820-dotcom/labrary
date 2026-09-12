import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ThemePalette, ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  customizerOpen = signal(false);
  readonly palettes = [
    { id: 'rose' as ThemePalette, name: 'وردي', colors: 'linear-gradient(90deg,#ff9a9e,#fecfef,#a1c4fd)' },
    { id: 'ocean' as ThemePalette, name: 'محيط', colors: 'linear-gradient(90deg,#89f7fe,#66a6ff)' },
    { id: 'violet' as ThemePalette, name: 'بنفسجي', colors: 'linear-gradient(90deg,#c471f5,#fa71cd)' },
    { id: 'emerald' as ThemePalette, name: 'زمردي', colors: 'linear-gradient(90deg,#84fab0,#8fd3f4)' },
    { id: 'sunset' as ThemePalette, name: 'غروب', colors: 'linear-gradient(90deg,#f6d365,#fda085)' }
  ];

  constructor(readonly theme: ThemeService) {}

  toggleMode(): void { this.theme.toggleMode(); }
  setPalette(palette: ThemePalette): void { this.theme.setPalette(palette); }
  toggleCustomizer(): void { this.customizerOpen.update(value => !value); }
}
