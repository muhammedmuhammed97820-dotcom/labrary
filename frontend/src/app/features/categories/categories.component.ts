import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

interface Category { _id: string; name: string; description?: string; booksCount?: number; }

@Component({
  selector: 'app-categories', standalone: true, imports: [CommonModule, RouterLink],
  template: `
  <section class="directory-page" [class.dark]="theme.isDarkMode()" dir="rtl">
    <div class="directory-hero"><span class="eyebrow">مكتبة الحكمة</span><h1>التصنيفات</h1><p>اكتشف الكتب حسب المجال والاهتمام.</p></div>
    <div class="directory-grid" *ngIf="!loading; else loadingTpl">
      <a class="directory-card category-card" *ngFor="let item of categories" [routerLink]="['/books']" [queryParams]="{category: item._id}">
        <div class="card-icon">▦</div><div><h2>{{ item.name }}</h2><p>{{ item.description || 'مجموعة كتب مختارة ضمن هذا التصنيف.' }}</p><strong>{{ item.booksCount || 0 }} كتاب</strong></div><span class="arrow">←</span>
      </a>
    </div>
    <ng-template #loadingTpl><div class="state">جارٍ تحميل التصنيفات...</div></ng-template>
    <div class="state error" *ngIf="error">{{ error }}</div>
  </section>`,
  styles: [`
    .directory-page{min-height:calc(100vh - 80px);padding:70px clamp(20px,5vw,80px);background:var(--bg-primary,#f7f7f4);color:var(--text-primary,#191919);transition:.25s}
    .directory-page.dark{--bg-primary:#0b0d11;--text-primary:#f4f5f7;background:#0b0d11;color:#f4f5f7}
    .directory-hero{max-width:1100px;margin:0 auto 42px}.eyebrow{font-size:12px;letter-spacing:2px;opacity:.55}.directory-hero h1{font-size:clamp(38px,6vw,70px);margin:8px 0}.directory-hero p{font-size:18px;opacity:.65}
    .directory-grid{max-width:1100px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.directory-card{position:relative;display:flex;gap:18px;align-items:flex-start;padding:28px;border:1px solid rgba(127,127,127,.18);border-radius:24px;text-decoration:none;color:inherit;background:rgba(255,255,255,.72);box-shadow:0 15px 45px rgba(0,0,0,.06);transition:transform .2s,box-shadow .2s}.dark .directory-card{background:#14171d}.directory-card:hover{transform:translateY(-5px);box-shadow:0 20px 55px rgba(0,0,0,.12)}.card-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:16px;background:#17191f;color:#fff;font-size:25px;flex:none}.directory-card h2{margin:0 0 8px;font-size:22px}.directory-card p{margin:0 0 14px;opacity:.62;line-height:1.7}.directory-card strong{font-size:13px;opacity:.7}.arrow{margin-right:auto;font-size:22px;opacity:.45}.state{max-width:1100px;margin:50px auto;text-align:center;padding:30px;opacity:.7}.error{color:#c33}
  `]
})
export class CategoriesComponent {
  private http = inject(HttpClient); public theme = inject(ThemeService); categories: Category[]=[]; loading=true; error='';
  constructor(){ this.http.get<Category[]>('http://localhost:5000/api/categories').subscribe({next:v=>{this.categories=v;this.loading=false},error:()=>{this.error='تعذر تحميل التصنيفات.';this.loading=false}}); }
}
