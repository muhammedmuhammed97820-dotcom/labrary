import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({selector:'app-navbar',standalone:true,imports:[RouterLink,RouterLinkActive],templateUrl:'./navbar.component.html',styleUrl:'./navbar.component.scss'})
export class NavbarComponent {
  private readonly auth=inject(AuthService); private readonly router=inject(Router); private readonly serverOrigin='http://localhost:5000'; menuOpen=false;
  get isAdmin():boolean{return this.auth.isAdmin} get isLoggedIn():boolean{return this.auth.isLoggedIn}
  get userName():string{return this.auth.currentUser?.name||'المستخدم'}
  get avatar():string|null{const v=this.auth.currentUser?.avatar;if(!v)return null;if(/^data:|^blob:|^https?:\/\//i.test(v))return v;return `${this.serverOrigin}${v.startsWith('/')?v:`/${v}`}`}
  get userInitial():string{return this.userName.trim().charAt(0)||'م'} logout(){this.auth.logout();this.closeMenu();this.router.navigate(['/login'])} closeMenu(){this.menuOpen=false} toggleMenu(){this.menuOpen=!this.menuOpen}
}
