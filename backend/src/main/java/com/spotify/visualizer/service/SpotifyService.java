package com.spotify.visualizer.service;

import com.spotify.visualizer.client.SpotifyApiClient;
import com.spotify.visualizer.model.SpotifyDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SpotifyService {

    private final SpotifyApiClient spotifyApiClient;

    private record DevicesResponse(List<SpotifyDto.Device> devices) {}

    public SpotifyDto.PlaybackState getPlaybackState() {
        try {
            return spotifyApiClient.get("/me/player", SpotifyDto.PlaybackState.class);
        } catch (Exception e) {
            log.error("Failed to fetch Spotify playback state", e);
            return null;
        }
    }

    public SpotifyDto.AudioFeatures getAudioFeatures(String trackId) {
        if (trackId == null || trackId.isBlank()) {
            return null;
        }
        try {
            return spotifyApiClient.get("/audio-features/" + trackId, SpotifyDto.AudioFeatures.class);
        } catch (Exception e) {
            log.error("Failed to fetch audio features for track: {}", trackId, e);
            return null;
        }
    }

    public SpotifyDto.AudioAnalysis getAudioAnalysis(String trackId) {
        if (trackId == null || trackId.isBlank()) {
            return null;
        }
        try {
            return spotifyApiClient.get("/audio-analysis/" + trackId, SpotifyDto.AudioAnalysis.class);
        } catch (Exception e) {
            log.error("Failed to fetch audio analysis for track: {}", trackId, e);
            return null;
        }
    }

    public List<SpotifyDto.Device> getDevices() {
        try {
            DevicesResponse response = spotifyApiClient.get("/me/player/devices", DevicesResponse.class);
            return response != null ? response.devices() : List.of();
        } catch (Exception e) {
            log.error("Failed to fetch available Spotify devices", e);
            return List.of();
        }
    }

    public void transferPlayback(String deviceId, boolean play) {
        String path = "/me/player";
        java.util.Map<String, Object> body = java.util.Map.of(
                "device_ids", java.util.List.of(deviceId),
                "play", play
        );
        try {
            spotifyApiClient.put(path, body);
        } catch (Exception e) {
            log.error("Failed to transfer playback to device: {}", deviceId, e);
        }
    }

    public void play(String deviceId) {
        String path = "/me/player/play";
        if (deviceId != null && !deviceId.isBlank()) {
            path += "?device_id=" + deviceId;
        }
        try {
            spotifyApiClient.put(path, null);
        } catch (Exception e) {
            log.error("Failed to resume playback on device: {}", deviceId, e);
        }
    }

    public void pause() {
        try {
            spotifyApiClient.put("/me/player/pause", null);
        } catch (Exception e) {
            log.error("Failed to pause playback", e);
        }
    }

    public void next() {
        try {
            spotifyApiClient.post("/me/player/next", null);
        } catch (Exception e) {
            log.error("Failed to skip to next track", e);
        }
    }

    public void previous() {
        try {
            spotifyApiClient.post("/me/player/previous", null);
        } catch (Exception e) {
            log.error("Failed to skip to previous track", e);
        }
    }

    public void seek(long positionMs) {
        try {
            spotifyApiClient.put("/me/player/seek?position_ms=" + positionMs, null);
        } catch (Exception e) {
            log.error("Failed to seek to position: {}", positionMs, e);
        }
    }
}
