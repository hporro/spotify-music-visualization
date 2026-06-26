import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, SpotifyUser } from '../../core/auth.service';
import { PlayerService } from '../../core/player.service';
import { VisualizerComponent, VisualizerMode } from '../visualizer/visualizer.component';
import { PlaybackState, SpotifyDevice } from '../../models/spotify.models';

import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, VisualizerComponent],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements OnInit, OnDestroy {
  currentUser: SpotifyUser | undefined;
  playbackState: PlaybackState | null = null;
  devices: SpotifyDevice[] = [];

  // Visualizer settings
  visualizerMode: VisualizerMode = 'bars2d';
  sensitivity: number = 1.0;

  // Local progress bar interpolation
  interpolatedProgressMs: number = 0;
  private progressInterval: any;
  isDraggingSlider: boolean = false;

  // Dropdown states
  showDevices: boolean = false;

  constructor(
    private authService: AuthService,
    private playerService: PlayerService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  getGlowingShadowStyle(url: string | undefined): SafeStyle {
    if (!url) return '';
    return this.sanitizer.bypassSecurityTrustStyle(`url(${url})`);
  }

  ngOnInit(): void {
    // Check auth status
    this.authService.getCurrentStatus$().subscribe(status => {
      if (status.loggedIn) {
        this.currentUser = status.user;
        if (status.accessToken) {
          this.playerService.initializeWebPlayer(status.accessToken);
        }
      }
    });

    // Subscribe to playback state updates
    this.playerService.getPlaybackState$().subscribe(state => {
      this.playbackState = state;
      if (state) {
        if (!this.isDraggingSlider) {
          this.interpolatedProgressMs = state.progress_ms;
        }
        this.setupProgressInterpolation(state);
      } else {
        this.interpolatedProgressMs = 0;
        this.clearProgressInterpolation();
      }
      this.cdr.detectChanges();
    });

    // Subscribe to device listing
    this.playerService.getDevices$().subscribe(devices => {
      this.devices = devices;
      this.cdr.detectChanges();
    });

    // Start background loops
    this.playerService.startPolling(1500);
    this.playerService.fetchDevices();
  }

  ngOnDestroy(): void {
    this.playerService.stopPolling();
    this.clearProgressInterpolation();
  }

  // Local slider progress interpolation
  private setupProgressInterpolation(state: PlaybackState): void {
    this.clearProgressInterpolation();

    if (state.is_playing && state.item) {
      const startTime = Date.now();
      const baseProgress = state.progress_ms;
      const duration = state.item.duration_ms;

      this.progressInterval = setInterval(() => {
        if (!this.isDraggingSlider) {
          const elapsed = Date.now() - startTime;
          this.interpolatedProgressMs = Math.min(duration, baseProgress + elapsed);
          this.cdr.detectChanges();
        }
      }, 100);
    }
  }

  private clearProgressInterpolation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  // Format milliseconds into mm:ss
  formatTime(ms: number): string {
    if (isNaN(ms) || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Device selectors
  toggleDevices(): void {
    this.showDevices = !this.showDevices;
    if (this.showDevices) {
      this.playerService.fetchDevices();
    }
  }

  selectDevice(device: SpotifyDevice): void {
    this.playerService.transferPlayback(device.id).subscribe(() => {
      this.showDevices = false;
    });
  }

  refreshDevices(): void {
    this.playerService.fetchDevices();
  }

  // Player controls
  togglePlay(): void {
    if (!this.playbackState) return;

    if (this.playbackState.is_playing) {
      this.playerService.pause().subscribe();
    } else {
      this.playerService.play().subscribe();
    }
  }

  next(): void {
    this.playerService.next().subscribe();
  }

  previous(): void {
    this.playerService.previous().subscribe();
  }

  onSliderInput(event: any): void {
    this.isDraggingSlider = true;
    this.interpolatedProgressMs = parseInt(event.target.value, 10);
    this.cdr.detectChanges();
  }

  onSliderChange(event: any): void {
    this.isDraggingSlider = false;
    const targetMs = parseInt(event.target.value, 10);
    this.interpolatedProgressMs = targetMs;
    this.playerService.seek(targetMs).subscribe();
    this.cdr.detectChanges();
  }

  // Settings
  setMode(mode: VisualizerMode): void {
    this.visualizerMode = mode;
  }

  onSensitivityChange(event: any): void {
    this.sensitivity = parseFloat(event.target.value);
  }

  // Logout
  onLogout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
