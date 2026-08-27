import {
  HttpInterceptorFn
} from '@angular/common/http';

export const apiInterceptor: HttpInterceptorFn =
  (request, next) => {

    const clonedRequest =
      request.clone({
        setHeaders: {
          Accept: 'application/json'
        }
      });

    return next(clonedRequest);
  };
