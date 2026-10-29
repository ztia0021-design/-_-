import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, tap, switchMap, finalize } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: 'learner' | 'tutor' | 'admin';
  greeting: string;
}

interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  role: 'learner' | 'tutor';
}

interface LoginPayload {
  email: string;
  password: string;
}

const TOKEN_KEY = 'studybridge_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  currentUser = signal<AuthUser | null>(null);
  isAuthenticated = computed(() => this.tokenSignal() !== null);

  // Task 1 requires /auth/me to finish before the first protected route.
  initialize(): Observable<AuthUser | null> {
    if (!this.tokenSignal()) {
      return of(null);
    }

    return this.refreshCurrentUser().pipe(
      catchError(() => {
        this.clearLocalSession();
        return of(null);
      }),
    );
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  register(payload: RegisterPayload): Observable<unknown> {
    return this.http.post(environment.apiBaseUrl + '/auth/register', payload);
  }

  login(credentials: LoginPayload): Observable<AuthUser> {
    return this.http
      .post<{ token: string }>(environment.apiBaseUrl + '/auth/login', credentials)
      .pipe(
        tap(({ token }) => this.storeToken(token)),
        switchMap(() => this.refreshCurrentUser()),
      );
  }

  logout(): Observable<unknown> {
    return this.http.post(environment.apiBaseUrl + '/auth/logout', {}).pipe(
      finalize(() => this.clearLocalSession()),
    );
  }

  clearLocalSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
    this.currentUser.set(null);
  }

  private storeToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
  }

  private refreshCurrentUser(): Observable<AuthUser> {
    return this.http.get<AuthUser>(environment.apiBaseUrl + '/auth/me').pipe(
      tap(user => this.currentUser.set(user)),
    );
  }
}
