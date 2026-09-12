import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  menuOpen = signal(false);
  customizerOpen = signal(false);
  isNight = signal(false);

  day = ['#ff9a9e', '#fecfef', '#a1c4fd'];
  night = ['#0f0c29', '#302b63', '#24243e'];

  constructor() {
    const saved = localStorage.getItem('library-theme');
    const night = saved === 'night';
    this.isNight.set(night);
    document.body.classList.toggle('theme-night', night);
    document.body.classList.toggle('theme-day', !night);
  }

  toggleMenu(): void { this.menuOpen.update(open => !open); }
  closeMenu(): void { this.menuOpen.set(false); }

  toggleTheme(): void {
    const night = !this.isNight();
    this.isNight.set(night);
    document.body.classList.toggle('theme-night', night);
    document.body.classList.toggle('theme-day', !night);
    localStorage.setItem('library-theme', night ? 'night' : 'day');
  }

  toggleCustomizer(): void {
    this.customizerOpen.update(open => !open);
    this.closeMenu();
  }

  setColor(mode: 'day' | 'night', index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const colors = mode === 'day' ? this.day : this.night;
    colors[index] = value;
    document.documentElement.style.setProperty(`--${mode}-c${index + 1}`, value);
  }

  applyPreset(preset: { day: string[]; night: string[] }): void {
    this.day = [...preset.day];
    this.night = [...preset.night];
    this.applyColors();
  }

  applyColors(): void {
    this.day.forEach((c, i) => document.documentElement.style.setProperty(`--day-c${i + 1}`, c));
    this.night.forEach((c, i) => document.documentElement.style.setProperty(`--night-c${i + 1}`, c));
  }

  presets = [
    { day: ['#ff9a9e', '#fecfef', '#a1c4fd'], night: ['#0f0c29', '#302b63', '#24243e'] },
    { day: ['#84fab0', '#a1c4fd', '#8fd3f4'], night: ['#09203f', '#537895', '#1e3c72'] },
    { day: ['#fccb90', '#fecfef', '#d57eeb'], night: ['#2b1055', '#7597de', '#240b36'] }
  ];
}
