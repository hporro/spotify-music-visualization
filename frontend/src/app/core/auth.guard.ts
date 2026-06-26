import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, take } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkStatus().pipe(
    take(1),
    map(status => {
      if (status.loggedIn) {
        return true;
      } else {
        router.navigate(['/login']);
        return false;
      }
    })
  );
};
