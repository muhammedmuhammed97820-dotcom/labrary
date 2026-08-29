import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

interface Author { _id:string; name:string; bio?:string; image?:string; nationality?:string; booksCount?:number; }

@Component({
 selector:'app-authors', standalone:true, imports:[CommonModule,RouterLink],
 template:`
 <section class="authors-page" [class.dark]="theme.isDarkMode()" dir="rtl">
   <div class="authors-shell">
     <header class="hero">
       <div class="hero-copy">
         <span class="eyebrow"><i></i>مَكتبة الحكمة · أرشيف الكُتّاب</span>
         <h1>وجوه صنعت<br><em>عالم الكتب.</em></h1>
         <p>تعرّف على المؤلفين الذين تركوا أثرًا في الأدب والفكر والمعرفة، واكتشف أعمالهم وسيرهم في مكان واحد.</p>
       </div>
       <div class="hero-stamp"><strong>أ</strong><span>AUTHORS</span><small>02</small></div>
     </header>

     <div class="toolbar" *ngIf="!loading"><div><span>المؤلفون</span><strong>{{ authors.length }}</strong></div><span class="hint">اختر مؤلفًا لاستكشاف سيرته وأعماله</span></div>
     <div class="authors-grid" *ngIf="!loading; else wait">
       <a class="author-card" *ngFor="let a of authors; let i=index" [routerLink]="['/authors',a._id]">
         <div class="portrait-wrap"><div class="portrait"><img *ngIf="a.image" [src]="imageUrl(a.image)" [alt]="a.name"><span *ngIf="!a.image">{{initial(a.name)}}</span></div><span class="index">{{(i+1).toString().padStart(2,'0')}}</span></div>
         <div class="author-info"><div class="name-row"><h2>{{a.name}}</h2><span>↗</span></div><p>{{a.bio || 'كاتب ومؤلف ضمن أرشيف مكتبة الحكمة.'}}</p><div class="meta"><span>{{a.booksCount || 0}} كتاب</span><span *ngIf="a.nationality">{{a.nationality}}</span></div></div>
       </a>
     </div>
     <ng-template #wait><div class="state"><span class="loader"></span><p>نستحضر أرشيف المؤلفين...</p></div></ng-template>
     <div class="state error" *ngIf="error">{{error}}</div>
   </div>
 </section>`,
 styles:[`
 :host{display:block}.authors-page{min-height:calc(100vh - 80px);background:#f5f3ee;color:#151515;transition:.35s}.authors-page.dark{background:#090b0f;color:#f2f0eb}.authors-shell{width:min(1280px,calc(100% - 48px));margin:auto;padding:78px 0 110px}.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:60px;padding-bottom:68px;border-bottom:1px solid rgba(100,100,100,.16)}.hero-copy{max-width:820px}.eyebrow{display:flex;align-items:center;gap:12px;font-size:11px;letter-spacing:2px;opacity:.5}.eyebrow i{display:block;width:35px;height:1px;background:currentColor}.hero h1{font-size:clamp(50px,7vw,90px);line-height:1.02;letter-spacing:-3px;margin:22px 0;font-weight:650}.hero h1 em{font-style:normal;opacity:.32}.hero p{max-width:680px;font-size:17px;line-height:2;opacity:.6;margin:0}.hero-stamp{width:155px;height:155px;border:1px solid rgba(100,100,100,.2);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;flex:none}.hero-stamp strong{font-family:serif;font-size:70px;font-weight:400;line-height:1}.hero-stamp span{font-size:8px;letter-spacing:4px;opacity:.4;margin-top:5px}.hero-stamp small{position:absolute;bottom:25px;font-size:9px;opacity:.4}.toolbar{display:flex;justify-content:space-between;align-items:center;margin:52px 0 24px}.toolbar div{display:flex;align-items:baseline;gap:12px}.toolbar div span{font-size:22px;font-weight:600}.toolbar div strong{font-size:12px;opacity:.4}.hint{font-size:12px;opacity:.4}.authors-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:rgba(100,100,100,.15);border:1px solid rgba(100,100,100,.15)}.author-card{display:flex;gap:24px;padding:25px;background:#f8f7f3;color:inherit;text-decoration:none;min-height:180px;transition:background .3s,transform .3s;position:relative}.dark .author-card{background:#0f1217}.author-card:hover{background:#fff;z-index:1}.dark .author-card:hover{background:#171b22}.portrait-wrap{position:relative;flex:none}.portrait{width:125px;height:125px;border-radius:50%;overflow:hidden;background:#20242b;color:#fff;display:grid;place-items:center;font:60px serif;box-shadow:0 15px 35px rgba(0,0,0,.12)}.portrait img{width:100%;height:100%;object-fit:cover}.index{position:absolute;bottom:0;left:-4px;width:27px;height:27px;border-radius:50%;background:#151515;color:#fff;display:grid;place-items:center;font-size:8px}.name-row{display:flex;align-items:center;gap:12px}.name-row h2{font-size:24px;margin:0;letter-spacing:-.5px}.name-row span{opacity:0;transform:translate(-5px,5px);transition:.3s}.author-card:hover .name-row span{opacity:.5;transform:none}.author-info p{font-size:13px;line-height:1.8;opacity:.5;margin:10px 0 15px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.meta{display:flex;gap:14px;font-size:10px;opacity:.5}.state{text-align:center;padding:80px;opacity:.6}.loader{display:inline-block;width:28px;height:28px;border:2px solid rgba(120,120,120,.2);border-top-color:currentColor;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.error{color:#b13b3b}@media(max-width:800px){.authors-grid{grid-template-columns:1fr}.hero-stamp{width:110px;height:110px}.hero-stamp strong{font-size:52px}}@media(max-width:600px){.authors-shell{width:calc(100% - 28px);padding-top:45px}.hero-stamp{display:none}.hero h1{font-size:50px;letter-spacing:-2px}.hero p{font-size:15px}.toolbar{margin-top:38px}.hint{display:none}.author-card{padding:18px;gap:17px}.portrait{width:90px;height:90px;font-size:42px}.name-row h2{font-size:20px}.author-info p{-webkit-line-clamp:2}}
 `]
})
export class AuthorsComponent{private http=inject(HttpClient);public theme=inject(ThemeService);authors:Author[]=[];loading=true;error='';constructor(){this.http.get<Author[]>('http://localhost:5000/api/authors').subscribe({next:v=>{this.authors=v;this.loading=false},error:()=>{this.error='تعذر تحميل المؤلفين.';this.loading=false}})}imageUrl(v:string){return /^https?:\/\//i.test(v)?v:`http://localhost:5000${v.startsWith('/')?v:`/${v}`}`}initial(n:string){return n?.trim()?.charAt(0)||'م'}}
