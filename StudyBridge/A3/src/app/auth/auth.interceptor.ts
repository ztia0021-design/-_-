import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl + '/')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.getToken();

  if (!token) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: { Authorization: 'Bearer ' + token },
  }));
};

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isBackend = req.url.startsWith(environment.apiBaseUrl + '/');
  const isLoginOrRegister = req.method === 'POST' && (
    req.url === environment.apiBaseUrl + '/auth/login' ||
    req.url === environment.apiBaseUrl + '/auth/register'
  );

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isBackend && !isLoginOrRegister) {
        auth.clearLocalSession();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
