import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <div class="background-glows">
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
      </div>
      
      <div class="login-card">
        <div class="logo-container">
          <svg viewBox="0 0 24 24" class="spotify-logo">
            <path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.982-.336.076-.67-.135-.746-.472-.076-.336.135-.67.472-.746 3.856-.882 7.15-.5 9.822 1.136.295.18.387.563.206.857zm1.225-2.72c-.227.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.075-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.667-1.112 8.243-.57 11.343 1.34.368.225.488.706.258 1.074zm.106-2.833C14.384 8.78 8.563 8.588 5.174 9.616c-.534.162-1.096-.142-1.258-.676-.162-.534.142-1.096.676-1.258 3.886-1.18 10.31-.954 14.382 1.463.48.285.637.902.352 1.383-.285.48-.903.638-1.383.353z"/>
          </svg>
        </div>
        
        <h1>Spotify Visualizer</h1>
        <p class="subtitle">Experience your favorite music in real-time 3D dimensions</p>
        
        <button class="login-button" (click)="onLogin()">
          <span class="btn-glow"></span>
          <span class="btn-text">Connect with Spotify</span>
        </button>

        <div *ngIf="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <div class="requirements-note">
          <p>Requires a Spotify account to access playback and audio features.</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  errorMessage: string | null = null;

  constructor(private authService: AuthService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        if (params['error'] === 'unauthorized') {
          this.errorMessage = 'Authorization rejected or state mismatch. Please try again.';
        } else {
          this.errorMessage = 'Authentication failed. Please check your credentials and network.';
        }
      }
    });
  }

  onLogin(): void {
    this.authService.login();
  }
}
