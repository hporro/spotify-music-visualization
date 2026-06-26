export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  volume_percent: number;
  is_active: boolean;
}

export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
}

export interface PlaybackState {
  device: SpotifyDevice;
  repeat_state: string;
  shuffle_state: boolean;
  timestamp: number;
  progress_ms: number;
  is_playing: boolean;
  item: SpotifyTrack;
}

export interface AudioFeatures {
  id: string;
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
  tempo: number;
  valence: number;
}

export interface TimeInterval {
  start: number;
  duration: number;
  confidence: number;
}

export interface SpotifySegment {
  start: number;
  duration: number;
  confidence: number;
  loudness_start: number;
  loudness_max_time: number;
  loudness_max: number;
  loudness_end: number;
  pitches: number[];
  timbre: number[];
}

export interface SpotifySection {
  start: number;
  duration: number;
  confidence: number;
  loudness: number;
  tempo: number;
  tempo_confidence: number;
  key: number;
  key_confidence: number;
  mode: number;
  mode_confidence: number;
}

export interface AudioAnalysis {
  bars: TimeInterval[];
  beats: TimeInterval[];
  tatums: TimeInterval[];
  sections: SpotifySection[];
  segments: SpotifySegment[];
}
