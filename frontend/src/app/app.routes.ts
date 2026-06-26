import { Routes } from '@angular/router';
import { LoginComponent } from './modules/auth/login.component';
import { PlayerComponent } from './modules/player/player.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: PlayerComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
