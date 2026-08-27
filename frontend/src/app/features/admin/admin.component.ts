import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  stats = [
    { label: 'إجمالي الكتب', value: '0', icon: '▤' },
    { label: 'المؤلفون', value: '0', icon: '◉' },
    { label: 'التصنيفات', value: '0', icon: '⌘' },
    { label: 'المشاهدات', value: '0', icon: '◌' }
  ];
}
