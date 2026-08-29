import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../core/services/theme.service';

@Component({selector:'app-author-details',standalone:true,imports:[CommonModule,RouterLink],template:`
<section class="author-detail" [class.dark]="theme.isDarkMode()" dir="rtl">
 <div class="shell">
  <a routerLink="/authors" class="back">← <span>العودة إلى المؤلفين</span></a>
  <div *ngIf="author;else loading" class="profile">
   <aside class="portrait-column"><div class="portrait"><img *ngIf="author.image" [src]="imageUrl(author.image)" [alt]="author.name"><span *ngIf="!author.image">{{author.name?.charAt(0)}}</span></div><div class="portrait-caption"><span>ARCHIVE</span><strong>AUTHOR</strong></div></aside>
   <main class="content">
    <span class="eyebrow">ملف المؤلف · {{author.booksCount || 0}} كتاب</span>
    <h1>{{author.name}}</h1>
    <p class="bio">{{author.bio || 'لا توجد سيرة ذاتية مضافة بعد.'}}</p>
    <div class="facts">
      <div *ngIf="author.birthDate"><small>الميلاد</small><strong>{{author.birthDate | date:'d MMMM yyyy'}}</strong></div>
      <div *ngIf="author.deathDate"><small>الوفاة</small><strong>{{author.deathDate | date:'d MMMM yyyy'}}</strong></div>
      <div *ngIf="author.birthPlace"><small>مكان الميلاد</small><strong>{{author.birthPlace}}</strong></div>
      <div *ngIf="author.nationality"><small>الجنسية</small><strong>{{author.nationality}}</strong></div>
      <div *ngIf="author.occupation"><small>المهنة</small><strong>{{author.occupation}}</strong></div>
      <div><small>المؤلفات</small><strong>{{author.booksCount || 0}} كتاب</strong></div>
    </div>
    <a *ngIf="author.website" class="website" [href]="author.website" target="_blank" rel="noopener">زيارة الموقع الرسمي ↗</a>
   </main>
  </div>
  <section class="works" *ngIf="author"><div class="works-head"><div><span>SELECTED WORKS</span><h2>أعمال {{author.name}}</h2></div><strong>{{author.booksCount || 0}}</strong></div><div class="books"><a class="book" *ngFor="let b of author.books;let i=index" [routerLink]="['/books',b._id]"><span class="book-index">{{(i+1).toString().padStart(2,'0')}}</span><img [src]="imageUrl(b.coverImage)" [alt]="b.title"><div><strong>{{b.title}}</strong><small>{{b.category?.name || 'عام'}}</small></div></a></div></section>
  <ng-template #loading><div class="state">جارٍ تحميل ملف المؤلف...</div></ng-template><div class="state error" *ngIf="error">{{error}}</div>
 </div>
</section>`,styles:[`
 :host{display:block}.author-detail{min-height:100vh;background:#f5f3ee;color:#151515;transition:.35s}.author-detail.dark{background:#090b0f;color:#f2f0eb}.shell{width:min(1280px,calc(100% - 48px));margin:auto;padding:48px 0 110px}.back{display:inline-flex;gap:9px;color:inherit;text-decoration:none;font-size:12px;opacity:.5;transition:.2s}.back:hover{opacity:1}.profile{display:grid;grid-template-columns:290px 1fr;gap:75px;max-width:1120px;margin:55px auto 95px}.portrait-column{position:relative}.portrait{width:290px;height:360px;border-radius:2px;overflow:hidden;background:#20242b;color:#fff;display:grid;place-items:center;font:130px serif;box-shadow:0 35px 80px rgba(0,0,0,.14)}.portrait img{width:100%;height:100%;object-fit:cover}.portrait-caption{display:flex;justify-content:space-between;margin-top:12px;font-size:8px;letter-spacing:2px;opacity:.38}.content{padding-top:10px}.eyebrow{font-size:10px;letter-spacing:2px;opacity:.48}.content h1{font-size:clamp(50px,7vw,92px);line-height:1;letter-spacing:-3px;margin:18px 0 24px}.bio{font-size:17px;line-height:2.05;opacity:.6;max-width:760px;margin:0}.facts{display:grid;grid-template-columns:repeat(3,1fr);margin-top:38px;border-top:1px solid rgba(100,100,100,.18);border-bottom:1px solid rgba(100,100,100,.18)}.facts div{padding:18px 12px;border-left:1px solid rgba(100,100,100,.14);display:flex;flex-direction:column;gap:7px}.facts div:last-child{border-left:0}.facts small{font-size:10px;opacity:.4}.facts strong{font-size:13px}.website{display:inline-block;color:inherit;text-decoration:none;margin-top:22px;font-size:12px;border-bottom:1px solid currentColor;padding-bottom:5px}.works{border-top:1px solid rgba(100,100,100,.16);padding-top:45px}.works-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:28px}.works-head span{font-size:9px;letter-spacing:3px;opacity:.38}.works-head h2{font-size:30px;margin:8px 0 0}.works-head>strong{font-size:12px;opacity:.4}.books{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}.book{color:inherit;text-decoration:none;position:relative}.book img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:2px;background:#ddd;box-shadow:0 16px 35px rgba(0,0,0,.1);transition:transform .35s,box-shadow .35s}.book:hover img{transform:translateY(-7px);box-shadow:0 25px 45px rgba(0,0,0,.18)}.book-index{position:absolute;z-index:1;top:9px;right:9px;width:25px;height:25px;border-radius:50%;background:rgba(10,10,10,.72);color:#fff;display:grid;place-items:center;font-size:8px}.book div{padding:12px 2px}.book strong,.book small{display:block}.book strong{font-size:14px;line-height:1.5}.book small{font-size:10px;opacity:.45;margin-top:5px}.state{text-align:center;padding:100px;opacity:.6}.error{color:#b13b3b}@media(max-width:900px){.profile{grid-template-columns:210px 1fr;gap:40px}.portrait{width:210px;height:280px}.books{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){.shell{width:calc(100% - 28px);padding-top:35px}.profile{grid-template-columns:1fr;margin-top:40px;gap:35px}.portrait{width:190px;height:240px;margin:auto}.content{text-align:right}.content h1{font-size:52px}.facts{grid-template-columns:repeat(2,1fr)}.facts div:nth-child(2n){border-left:0}.books{grid-template-columns:repeat(2,1fr);gap:14px}.works-head h2{font-size:24px}}
 `]})
export class AuthorDetailsComponent{private http=inject(HttpClient);private route=inject(ActivatedRoute);public theme=inject(ThemeService);author:any=null;error='';constructor(){const id=this.route.snapshot.paramMap.get('id');this.http.get<any>(`http://localhost:5000/api/authors/${id}`).subscribe({next:v=>this.author=v,error:()=>this.error='تعذر تحميل المؤلف.'})}imageUrl(v:string){return /^https?:\/\//i.test(v)?v:`http://localhost:5000${v?.startsWith('/')?v:`/${v||''}`}`}}
