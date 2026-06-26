import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, switchMap } from 'rxjs';
import { PlaybackState, AudioFeatures, AudioAnalysis, SpotifyDevice } from '../models/spotify.models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PlayerService implements OnDestroy {
  private readonly apiBase = '/api/player';

  private playbackState$ = new BehaviorSubject<PlaybackState | null>(null);
  private audioFeatures$ = new BehaviorSubject<AudioFeatures | null>(null);
  private audioAnalysis$ = new BehaviorSubject<AudioAnalysis | null>(null);
  private devices$ = new BehaviorSubject<SpotifyDevice[]>([]);

  private socket: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private currentTrackId: string | null = null;

  // Spotify Web Playback SDK
  private webPlayer: any = null;
  private webDeviceId: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnDestroy(): void {
    this.stopPolling();
    this.disconnectWebPlayer();
  }

  startPolling(intervalMs?: number): void {
    this.connect();
  }

  stopPolling(): void {
    this.disconnect();
  }

  private connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log('Establishing Spotify Player WebSocket connection...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}/ws/player`);

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error === 'unauthorized') {
          console.warn('WebSocket unauthorized. Disconnecting.');
          this.disconnect();
          return;
        }

        // If local WebPlayer is currently playing and active, ignore server state pushes
        // to prevent sluggish latency-based toggles.
        if (this.webPlayer && this.playbackState$.value && this.playbackState$.value.device?.id === this.webDeviceId && this.playbackState$.value.is_playing) {
          return;
        }

        // Empty state represents no active playback
        if (!data || Object.keys(data).length === 0 || !data.item) {
          // If we have a local player, don't clear it immediately to avoid empty flashes
          if (!this.webPlayer) {
            this.playbackState$.next(null);
            this.currentTrackId = null;
            this.audioFeatures$.next(null);
            this.audioAnalysis$.next(null);
          }
          return;
        }

        const state: PlaybackState = data;
        this.playbackState$.next(state);

        const trackId = state.item.id;
        if (trackId !== this.currentTrackId) {
          this.currentTrackId = trackId;
          this.fetchTrackDetails(trackId);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message payload', err);
      }
    };

    this.socket.onclose = (event) => {
      console.warn('Player WebSocket closed. Scheduling reconnection...', event);
      this.socket = null;
      this.scheduleReconnect();
    };

    this.socket.onerror = (err) => {
      console.error('Player WebSocket error: ', err);
      if (this.socket) {
        this.socket.close();
      }
    };
  }

  private disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
      console.log('Player WebSocket disconnected.');
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  // Spotify Web Playback SDK Initialization
  initializeWebPlayer(initialToken?: string): void {
    if (this.webPlayer) return;

    const initPlayer = () => {
      console.log('Initializing Spotify Web Playback SDK...');
      const player = new (window as any).Spotify.Player({
        name: 'Web Visualizer Browser Player',
        getOAuthToken: (cb: any) => {
          this.authService.checkStatus().subscribe({
            next: (status) => {
              if (status.accessToken) {
                cb(status.accessToken);
              } else if (initialToken) {
                cb(initialToken);
              } else {
                console.error('Spotify SDK: No access token available');
              }
            },
            error: (err) => {
              console.error('Spotify SDK: Token check failed', err);
              if (initialToken) {
                cb(initialToken);
              }
            }
          });
        },
        volume: 0.5
      });

      player.addListener('initialization_error', ({ message }: any) => { console.error('Spotify SDK Init Error:', message); });
      player.addListener('authentication_error', ({ message }: any) => { console.error('Spotify SDK Auth Error:', message); });
      player.addListener('account_error', ({ message }: any) => { console.error('Spotify SDK Account Error:', message); });
      player.addListener('playback_error', ({ message }: any) => { console.error('Spotify SDK Playback Error:', message); });

      player.addListener('player_state_changed', (state: any) => {
        if (state) {
          this.handleWebPlayerStateChange(state);
        }
      });

      player.addListener('ready', ({ device_id }: any) => {
        console.log('Spotify Browser Player ready with Device ID:', device_id);
        this.webDeviceId = device_id;
        this.fetchDevices();
      });

      player.addListener('not_ready', ({ device_id }: any) => {
        console.warn('Spotify Browser Player device has gone offline:', device_id);
        this.webDeviceId = null;
      });

      player.connect().then((success: boolean) => {
        if (success) {
          console.log('Successfully connected Spotify Browser Player to Spotify!');
        }
      });

      this.webPlayer = player;
    };

    if ((window as any).Spotify) {
      initPlayer();
    } else {
      (window as any).onSpotifyWebPlaybackSDKReady = () => {
        initPlayer();
      };
    }
  }

  private disconnectWebPlayer(): void {
    if (this.webPlayer) {
      this.webPlayer.disconnect();
      this.webPlayer = null;
      this.webDeviceId = null;
      console.log('Spotify Browser Player disconnected.');
    }
  }

  private handleWebPlayerStateChange(state: any): void {
    if (!state) return;

    const currentTrack = state.track_window?.current_track;
    if (!currentTrack) return;

    // Safe track ID parsing
    let trackId = currentTrack.id || '';
    if (!trackId && currentTrack.uri) {
      const parts = currentTrack.uri.split(':');
      if (parts.length === 3 && parts[1] === 'track') {
        trackId = parts[2];
      }
    }

    // Safe album ID parsing
    let albumId = '';
    if (currentTrack.album?.uri) {
      const parts = currentTrack.album.uri.split(':');
      if (parts.length === 3) {
        albumId = parts[2];
      }
    }

    // Convert Web SDK state format to matching PlaybackState interface
    const mappedState: PlaybackState = {
      device: {
        id: this.webDeviceId || 'browser-player',
        name: 'Browser Player (This Tab)',
        type: 'Computer',
        volume_percent: 50,
        is_active: true
      },
      repeat_state: state.repeat_mode === 1 ? 'context' : state.repeat_mode === 2 ? 'track' : 'off',
      shuffle_state: state.shuffle,
      timestamp: Date.now(),
      progress_ms: state.position,
      is_playing: !state.paused,
      item: {
        id: trackId,
        name: currentTrack.name || 'Unknown Track',
        duration_ms: state.duration || 0,
        album: {
          id: albumId,
          name: currentTrack.album?.name || 'Unknown Album',
          images: (currentTrack.album?.images || []).map((img: any) => ({
            url: img.url || '',
            height: img.height || 300,
            width: img.width || 300
          }))
        },
        artists: (currentTrack.artists || []).map((art: any) => {
          let artistId = '';
          if (art.uri) {
            const parts = art.uri.split(':');
            if (parts.length === 3) artistId = parts[2];
          }
          return {
            id: artistId,
            name: art.name || 'Unknown Artist'
          };
        })
      }
    };

    // Emit state directly
    this.playbackState$.next(mappedState);

    // Fetch analysis features if song changes
    if (trackId && trackId !== this.currentTrackId) {
      this.currentTrackId = trackId;
      this.fetchTrackDetails(trackId);
    }
  }

  getPlaybackState$(): Observable<PlaybackState | null> {
    return this.playbackState$.asObservable();
  }

  getAudioFeatures$(): Observable<AudioFeatures | null> {
    return this.audioFeatures$.asObservable();
  }

  getAudioAnalysis$(): Observable<AudioAnalysis | null> {
    return this.audioAnalysis$.asObservable();
  }

  getDevices$(): Observable<SpotifyDevice[]> {
    return this.devices$.asObservable();
  }

  fetchDevices(): void {
    this.http.get<SpotifyDevice[]>(`${this.apiBase}/devices`, { withCredentials: true }).pipe(
      catchError(err => {
        console.error('Error fetching devices', err);
        return of([]);
      })
    ).subscribe(devices => {
      // Append our browser player to the list if ready
      let list = [...devices];
      if (this.webDeviceId) {
        const hasBrowser = list.some(d => d.id === this.webDeviceId);
        if (!hasBrowser) {
          list.unshift({
            id: this.webDeviceId,
            name: 'Browser Player (This Tab)',
            type: 'Computer',
            volume_percent: 50,
            is_active: this.playbackState$.value?.device?.id === this.webDeviceId
          });
        }
      }
      this.devices$.next(list);
    });
  }

  private fetchTrackDetails(trackId: string): void {
    this.http.get<AudioFeatures>(`${this.apiBase}/audio-features/${trackId}`, { withCredentials: true }).pipe(
      catchError(err => {
        console.error('Error fetching audio features', err);
        return of(null);
      })
    ).subscribe(features => {
      this.audioFeatures$.next(features);
    });

    this.http.get<AudioAnalysis>(`${this.apiBase}/audio-analysis/${trackId}`, { withCredentials: true }).pipe(
      catchError(err => {
        console.error('Error fetching audio analysis', err);
        return of(null);
      })
    ).subscribe(analysis => {
      this.audioAnalysis$.next(analysis);
    });
  }

  transferPlayback(deviceId: string): Observable<boolean> {
    return this.http.put<any>(`${this.apiBase}/device?deviceId=${deviceId}`, {}, { withCredentials: true }).pipe(
      switchMap(() => {
        // If transferring to Web Player, optimize UI state instantly
        if (this.webPlayer && deviceId === this.webDeviceId) {
          if (this.playbackState$.value) {
            this.playbackState$.next({
              ...this.playbackState$.value,
              device: {
                id: this.webDeviceId,
                name: 'Browser Player (This Tab)',
                type: 'Computer',
                volume_percent: 50,
                is_active: true
              }
            });
          }
        } else {
          this.triggerImmediatePoll();
        }
        return of(true);
      }),
      catchError(() => of(false))
    );
  }

  play(deviceId?: string): Observable<boolean> {
    const isActiveDeviceWeb = this.playbackState$.value?.device?.id === this.webDeviceId;
    if (this.webPlayer && ((deviceId && deviceId === this.webDeviceId) || (!deviceId && isActiveDeviceWeb))) {
      this.webPlayer.resume().then(() => {
        if (this.playbackState$.value) {
          this.playbackState$.next({
            ...this.playbackState$.value,
            is_playing: true
          });
        }
      });
      return of(true);
    }

    const url = deviceId ? `${this.apiBase}/play?deviceId=${deviceId}` : `${this.apiBase}/play`;
    return this.http.post<any>(url, {}, { withCredentials: true }).pipe(
      switchMap(() => {
        this.triggerImmediatePoll();
        return of(true);
      }),
      catchError(() => of(false))
    );
  }

  pause(): Observable<boolean> {
    const isActiveDeviceWeb = this.playbackState$.value?.device?.id === this.webDeviceId;
    if (this.webPlayer && isActiveDeviceWeb) {
      this.webPlayer.pause().then(() => {
        if (this.playbackState$.value) {
          this.playbackState$.next({
            ...this.playbackState$.value,
            is_playing: false
          });
        }
      });
      return of(true);
    }

    return this.http.post<any>(`${this.apiBase}/pause`, {}, { withCredentials: true }).pipe(
      switchMap(() => {
        this.triggerImmediatePoll();
        return of(true);
      }),
      catchError(() => of(false))
    );
  }

  next(): Observable<boolean> {
    const isActiveDeviceWeb = this.playbackState$.value?.device?.id === this.webDeviceId;
    if (this.webPlayer && isActiveDeviceWeb) {
      this.webPlayer.nextTrack();
      return of(true);
    }

    return this.http.post<any>(`${this.apiBase}/next`, {}, { withCredentials: true }).pipe(
      switchMap(() => {
        this.triggerImmediatePoll();
        return of(true);
      }),
      catchError(() => of(false))
    );
  }

  previous(): Observable<boolean> {
    const isActiveDeviceWeb = this.playbackState$.value?.device?.id === this.webDeviceId;
    if (this.webPlayer && isActiveDeviceWeb) {
      this.webPlayer.previousTrack();
      return of(true);
    }

    return this.http.post<any>(`${this.apiBase}/previous`, {}, { withCredentials: true }).pipe(
      switchMap(() => {
        this.triggerImmediatePoll();
        return of(true);
      }),
      catchError(() => of(false))
    );
  }

  seek(positionMs: number): Observable<boolean> {
    const isActiveDeviceWeb = this.playbackState$.value?.device?.id === this.webDeviceId;
    if (this.webPlayer && isActiveDeviceWeb) {
      this.webPlayer.seek(positionMs).then(() => {
        if (this.playbackState$.value) {
          this.playbackState$.next({
            ...this.playbackState$.value,
            progress_ms: positionMs
          });
        }
      });
      return of(true);
    }

    return this.http.post<any>(`${this.apiBase}/seek?positionMs=${positionMs}`, {}, { withCredentials: true }).pipe(
      switchMap(() => {
        this.triggerImmediatePoll();
        return of(true);
      }),
      catchError(() => of(false))
    );
  }

  private triggerImmediatePoll(): void {
    setTimeout(() => {
      // Skip if local web player is active to avoid override
      if (this.webPlayer && this.playbackState$.value && this.playbackState$.value.device?.id === this.webDeviceId) {
        return;
      }
      this.http.get<PlaybackState | null>(`${this.apiBase}/current-track`, { withCredentials: true }).pipe(
        catchError(() => of(null))
      ).subscribe(state => {
        if (state) {
          this.playbackState$.next(state);
        }
      });
    }, 400);
  }
}
