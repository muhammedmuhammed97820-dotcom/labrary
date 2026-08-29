import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

interface Category { _id: string; name: string; description?: string; booksCount?: number; }

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="categories-page" [class.dark]="theme.isDarkMode()" dir="rtl">
      <div class="categories-shell">
        <header class="directory-hero">
          <div class="hero-copy">
            <span class="eyebrow"><span class="eyebrow-line"></span>مَكتبة الحكمة · فهرس المعرفة</span>
            <h1>اكتشف <em>مجالك</em><br>واقرأ ما يليق بك.</h1>
            <p>تصفح مجموعات المكتبة حسب المجال، واعثر على الكتب التي توسّع أفكارك وتفتح لك أبوابًا جديدة للمعرفة.</p>
          </div>
          <div class="hero-mark" aria-hidden="true"><span>م</span><small>01</small></div>
        </header>

        <div class="section-head" *ngIf="!loading">
          <div><span class="section-kicker">COLLECTIONS</span><h2>مجموعات المكتبة</h2></div>
          <span class="count-badge">{{ categories.length }} تصنيف</span>
        </div>

        <div class="category-grid" *ngIf="!loading; else loadingTpl">
          <a class="category-card" *ngFor="let item of categories; let i = index" [routerLink]="['/books']" [queryParams]="{category: item._id}">
            <div class="card-top"><span class="number">{{ (i + 1).toString().padStart(2, '0') }}</span><span class="card-arrow">↗</span></div>
            <div class="category-symbol">✦</div>
            <div class="card-content"><h3>{{ item.name }}</h3><p>{{ item.description || 'مجموعة منتقاة من الكتب والمعارف ضمن هذا المجال.' }}</p></div>
            <div class="card-footer"><span>{{ item.booksCount || 0 }} كتاب</span><span>استكشف المجموعة</span></div>
          </a>
        </div>

        <ng-template #loadingTpl><div class="state"><span class="loader"></span><p>نجهّز مجموعات المعرفة...</p></div></ng-template>
        <div class="state error" *ngIf="error">{{ error }}</div>
      </div>
    </section>
  `,
  styles: [`
    :host{display:block}.categories-page{min-height:calc(100vh - 80px);background:var(--bg-primary,#f5f3ee);color:var(--text-primary,#151515);transition:background .35s,color .35s}.categories-page.dark{--bg-primary:#090b0f;--text-primary:#f2f0eb;background:#090b0f;color:#f2f0eb}.categories-shell{width:min(1280px,calc(100% - 48px));margin:auto;padding:78px 0 110px}.directory-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:50px;padding-bottom:68px;border-bottom:1px solid rgba(100,100,100,.16)}.hero-copy{max-width:850px}.eyebrow{display:flex;align-items:center;gap:12px;font-size:11px;letter-spacing:2px;opacity:.56;text-transform:uppercase}.eyebrow-line{width:34px;height:1px;background:currentColor}.hero-copy h1{font-size:clamp(45px,7vw,88px);line-height:1.04;letter-spacing:-2.8px;margin:22px 0 22px;font-weight:650}.hero-copy h1 em{font-style:normal;opacity:.38}.hero-copy p{max-width:650px;font-size:17px;line-height:2;opacity:.62;margin:0}.hero-mark{width:150px;height:150px;border:1px solid rgba(100,100,100,.18);border-radius:50%;display:grid;place-items:center;position:relative;flex:none}.hero-mark span{font-family:serif;font-size:68px}.hero-mark small{position:absolute;bottom:25px;right:32px;font-size:9px;letter-spacing:2px;opacity:.45}.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin:58px 0 25px}.section-kicker{font-size:10px;letter-spacing:3px;opacity:.42}.section-head h2{margin:8px 0 0;font-size:30px;letter-spacing:-.6px}.count-badge{font-size:12px;opacity:.5;border:1px solid rgba(100,100,100,.2);padding:9px 14px;border-radius:30px}.category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.category-card{min-height:310px;padding:25px;display:flex;flex-direction:column;text-decoration:none;color:inherit;border:1px solid rgba(100,100,100,.16);border-radius:4px;background:rgba(255,255,255,.52);position:relative;overflow:hidden;transition:transform .35s cubic-bezier(.2,.7,.2,1),border-color .35s,background .35s,box-shadow .35s}.dark .category-card{background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.1)}.category-card:before{content:"";position:absolute;inset:auto -20% -55% -20%;height:65%;background:radial-gradient(circle,rgba(100,100,100,.09),transparent 65%);transition:transform .5s}.category-card:hover{transform:translateY(-8px);border-color:rgba(100,100,100,.35);box-shadow:0 28px 70px rgba(0,0,0,.09)}.dark .category-card:hover{box-shadow:0 28px 70px rgba(0,0,0,.3)}.category-card:hover:before{transform:translateY(-20px)}.card-top,.card-footer{display:flex;justify-content:space-between;align-items:center}.number{font-size:10px;letter-spacing:2px;opacity:.38}.card-arrow{font-size:23px;opacity:.4;transition:transform .3s,opacity .3s}.category-card:hover .card-arrow{transform:translate(4px,-4px);opacity:1}.category-symbol{width:52px;height:52px;border:1px solid rgba(100,100,100,.2);border-radius:50%;display:grid;place-items:center;font-size:18px;margin-top:35px;transition:transform .4s}.category-card:hover .category-symbol{transform:rotate(20deg) scale(1.06)}.card-content{position:relative;margin-top:auto}.card-content h3{font-size:28px;margin:0 0 9px;letter-spacing:-.5px}.card-content p{font-size:13px;line-height:1.8;opacity:.52;max-width:330px;margin:0}.card-footer{position:relative;margin-top:26px;padding-top:15px;border-top:1px solid rgba(100,100,100,.13);font-size:11px}.card-footer span:first-child{font-weight:650}.card-footer span:last-child{opacity:.42}.state{min-height:300px;display:grid;place-items:center;text-align:center;opacity:.6}.state p{margin-top:-100px}.loader{width:30px;height:30px;border:2px solid rgba(120,120,120,.2);border-top-color:currentColor;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.error{color:#b13b3b;display:block;padding:50px;text-align:center}@media(max-width:900px){.category-grid{grid-template-columns:repeat(2,1fr)}.hero-mark{width:110px;height:110px}.hero-mark span{font-size:50px}}@media(max-width:650px){.categories-shell{width:min(100% - 28px,1280px);padding-top:45px}.directory-hero{align-items:flex-start}.hero-mark{display:none}.hero-copy h1{font-size:48px;letter-spacing:-1.8px}.category-grid{grid-template-columns:1fr}.category-card{min-height:285px}.section-head{margin-top:40px}}
  `]
})
export class CategoriesComponent {
  private http = inject(HttpClient); public theme = inject(ThemeService); categories: Category[] = []; loading = true; error = '';
  constructor(){ this.http.get<Category[]>('http://localhost:5000/api/categories').subscribe({next:v=>{this.categories=v;this.loading=false},error:()=>{this.error='تعذر تحميل التصنيفات.';this.loading=false}}); }
}
