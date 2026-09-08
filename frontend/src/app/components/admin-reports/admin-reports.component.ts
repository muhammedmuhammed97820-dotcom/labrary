import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommunityService, ModerationItem } from '../../core/services/community.service';
import { NotificationService } from '../../core/services/notification.service';
@Component({ selector:'app-admin-reports', standalone:true, imports:[CommonModule,RouterLink], templateUrl:'./admin-reports.component.html', styleUrl:'./admin-reports.component.scss' })
export class AdminReportsComponent implements OnInit {
  private readonly service=inject(CommunityService); private readonly notify=inject(NotificationService); items:ModerationItem[]=[]; loading=true; busy='';
  ngOnInit(){this.load()}
  load(){this.loading=true;this.service.adminReports().subscribe({next:r=>{this.items=r.items;this.loading=false},error:e=>{this.loading=false;this.notify.error(e?.error?.message||'تعذر تحميل البلاغات')}})}
  review(item:ModerationItem,action:'restore'|'reject'){const id=(item.item as any)._id;if(action==='reject'&&!confirm('هل تريد إخفاء هذا المحتوى نهائياً؟'))return;this.busy=id;this.service.review(item.type,id,action,action==='reject'?'محتوى مخالف بعد مراجعة الإدارة':'').subscribe({next:r=>{this.notify.success(r.message);this.items=this.items.filter(x=>x!==item);this.busy=''},error:e=>{this.busy='';this.notify.error(e?.error?.message||'تعذر تنفيذ المراجعة')}})}
  reasonLabel(r:string){return ({abuse:'إساءة أو محتوى مسيء',spam:'رسائل مزعجة/سبام',misinformation:'معلومات مضللة',copyright:'حقوق نشر',other:'سبب آخر'} as any)[r]||r}
}
