import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  show(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    const arabicMessage = this.toArabic(message, type);
    const id = Date.now();
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, { id, message: arabicMessage, type }]);

    setTimeout(() => this.remove(id), 3500);
  }

  remove(id: number): void {
    const updated = this.toastsSubject.value.filter(t => t.id !== id);
    this.toastsSubject.next(updated);
  }

  private toArabic(message: string, type: 'success' | 'error' | 'info'): string {
    const text = String(message ?? '').trim();

    // الرسائل العربية تمر كما هي.
    if (!text || /[\u0600-\u06FF]/.test(text)) {
      return text || this.defaultArabic(type);
    }

    const value = text.toLowerCase();

    const translations: Array<[RegExp, string]> = [
      [/\b(unauthorized|401|token expired|session expired)\b/, 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.'],
      [/\b(forbidden|403|access denied|not allowed)\b/, 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'],
      [/\b(not found|404)\b/, 'العنصر المطلوب غير موجود.'],
      [/\b(network error|network|connection|failed to fetch|unable to connect)\b/, 'تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى.'],
      [/\b(required|missing required)\b/, 'يرجى إكمال الحقول المطلوبة.'],
      [/\b(invalid|validation failed|bad request|400)\b/, 'البيانات المدخلة غير صحيحة، يرجى التحقق منها.'],
      [/\b(too large|file size|payload too large|413)\b/, 'حجم الملف كبير جداً.'],
      [/\b(unsupported|invalid file type|file type)\b/, 'نوع الملف غير مدعوم.'],
      [/\b(login|logged in|sign in)\b/,
        value.includes('success') || value.includes('successful') ? 'تم تسجيل الدخول بنجاح.' : 'تعذر تسجيل الدخول، يرجى التحقق من البيانات.'],
      [/\b(logout|logged out|sign out)\b/, 'تم تسجيل الخروج بنجاح.'],
      [/\b(register|registered|sign up|account created)\b/, 'تم إنشاء الحساب بنجاح.'],
      [/\b(upload|uploaded)\b/,
        value.includes('success') || value.includes('successful') ? 'تم رفع الملف بنجاح.' : 'تعذر رفع الملف، يرجى المحاولة مرة أخرى.'],
      [/\b(delete|deleted|remove|removed)\b/,
        value.includes('success') || value.includes('successful') ? 'تم الحذف بنجاح.' : 'تعذر الحذف، يرجى المحاولة مرة أخرى.'],
      [/\b(update|updated|edit|edited)\b/,
        value.includes('success') || value.includes('successful') ? 'تم التحديث بنجاح.' : 'تعذر تحديث البيانات، يرجى المحاولة مرة أخرى.'],
      [/\b(create|created|added|add)\b/,
        value.includes('success') || value.includes('successful') ? 'تمت الإضافة بنجاح.' : 'تعذر إضافة البيانات، يرجى المحاولة مرة أخرى.'],
      [/\b(book|books)\b.*\bnot found\b/, 'الكتاب المطلوب غير موجود.'],
      [/\bserver error|internal server error|500\b/, 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً.'],
      [/\b(error|failed|failure|exception)\b/, 'حدث خطأ، يرجى المحاولة مرة أخرى.'],
      [/\bsuccess(fully)?\b|\bsuccessful\b/, 'تمت العملية بنجاح.']
    ];

    for (const [pattern, translated] of translations) {
      if (pattern.test(value)) return translated;
    }

    // لا نعرض أي نص إنجليزي للمستخدم حتى لو أضاف أحد المكونات رسالة جديدة.
    return this.defaultArabic(type);
  }

  private defaultArabic(type: 'success' | 'error' | 'info'): string {
    switch (type) {
      case 'success': return 'تمت العملية بنجاح.';
      case 'info': return 'لديك إشعار جديد.';
      default: return 'حدث خطأ، يرجى المحاولة مرة أخرى.';
    }
  }
}
