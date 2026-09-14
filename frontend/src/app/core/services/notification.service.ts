import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();

  show(message: string, type: Toast['type'] = 'success'): void {
    const arabicMessage = this.toArabic(message, type);
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, { id, message: arabicMessage, type }]);

    setTimeout(() => this.remove(id), 4500);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  remove(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter(toast => toast.id !== id));
  }

  private toArabic(message: string, type: Toast['type']): string {
    const text = String(message ?? '').trim();

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
        value.includes('success') || value.includes('successful') ? 'تم حذف المستخدم بنجاح.' : 'تعذر الحذف، يرجى المحاولة مرة أخرى.'],
      [/\b(update|updated|edit|edited)\b/,
        value.includes('success') || value.includes('successful') ? 'تم تحديث البيانات بنجاح.' : 'تعذر تحديث البيانات، يرجى المحاولة مرة أخرى.'],
      [/\b(create|created|added|add)\b/,
        value.includes('success') || value.includes('successful') ? 'تمت الإضافة بنجاح.' : 'تعذر إضافة البيانات، يرجى المحاولة مرة أخرى.'],
      [/\bserver error|internal server error|500\b/, 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً.'],
      [/\b(error|failed|failure|exception)\b/, 'حدث خطأ، يرجى المحاولة مرة أخرى.'],
      [/\bsuccess(fully)?\b|\bsuccessful\b/, 'تمت العملية بنجاح.']
    ];

    for (const [pattern, translated] of translations) {
      if (pattern.test(value)) return translated;
    }

    return this.defaultArabic(type);
  }

  private defaultArabic(type: Toast['type']): string {
    switch (type) {
      case 'success': return 'تمت العملية بنجاح.';
      case 'warning': return 'تنبيه: يرجى التحقق من البيانات.';
      case 'info': return 'لديك إشعار جديد.';
      default: return 'حدث خطأ، يرجى المحاولة مرة أخرى.';
    }
  }
}
