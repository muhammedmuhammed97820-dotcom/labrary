import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  mode: 'login' | 'register' = 'login';
  name = '';
  email = '';
  password = '';
  showPassword = false;

  submit(): void {
    // Authentication API is connected in the backend integration phase.
    console.info(`${this.mode} requested`, { name: this.name, email: this.email });
  }

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
  }
}
