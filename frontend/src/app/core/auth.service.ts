import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';

export interface SpotifyUser {
  id: string;
  display_name: string;
  images: { url: string; height: number; width: number }[];
}

export interface AuthStatus {
  loggedIn: boolean;
  user?: SpotifyUser;
  accessToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiBase = `http://${window.location.hostname}:8080/api/auth`;
  private authStatus$ = new BehaviorSubject<AuthStatus>({ loggedIn: false });

  constructor(private http: HttpClient) {}

  checkStatus(): Observable<AuthStatus> {
    return this.http.get<AuthStatus>(`${this.apiBase}/status`, { withCredentials: true }).pipe(
      map(status => {
        this.authStatus$.next(status);
        return status;
      }),
      catchError(() => {
        const failedStatus = { loggedIn: false };
        this.authStatus$.next(failedStatus);
        return of(failedStatus);
      })
    );
  }

  isLoggedIn$(): Observable<boolean> {
    return this.authStatus$.asObservable().pipe(map(s => s.loggedIn));
  }

  getCurrentStatus$(): Observable<AuthStatus> {
    return this.authStatus$.asObservable();
  }

  getCurrentUser(): SpotifyUser | undefined {
    return this.authStatus$.value.user;
  }

  login(): void {
    window.location.href = `${this.apiBase}/login`;
  }

  logout(): Observable<boolean> {
    return this.http.post<{ success: boolean }>(`${this.apiBase}/logout`, {}, { withCredentials: true }).pipe(
      map(res => {
        this.authStatus$.next({ loggedIn: false });
        return res.success;
      }),
      catchError(() => {
        this.authStatus$.next({ loggedIn: false });
        return of(true);
      })
    );
  }
}
