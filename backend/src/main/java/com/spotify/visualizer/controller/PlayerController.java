package com.spotify.visualizer.controller;

import com.spotify.visualizer.model.SpotifyDto;
import com.spotify.visualizer.service.SpotifyService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/player")
@RequiredArgsConstructor
public class PlayerController {

    private final SpotifyService spotifyService;

    private void checkSession(HttpSession session) {
        if (session.getAttribute("spotify_session") == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized - Spotify session not found");
        }
    }

    @GetMapping("/current-track")
    public ResponseEntity<SpotifyDto.PlaybackState> getCurrentTrack(HttpSession session) {
        checkSession(session);
        SpotifyDto.PlaybackState state = spotifyService.getPlaybackState();
        if (state == null) {
            // Can return 204 No Content if there's no active player session on Spotify
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(state);
    }

    @GetMapping("/audio-features/{trackId}")
    public ResponseEntity<SpotifyDto.AudioFeatures> getAudioFeatures(@PathVariable String trackId, HttpSession session) {
        checkSession(session);
        SpotifyDto.AudioFeatures features = spotifyService.getAudioFeatures(trackId);
        if (features == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(features);
    }

    @GetMapping("/audio-analysis/{trackId}")
    public ResponseEntity<SpotifyDto.AudioAnalysis> getAudioAnalysis(@PathVariable String trackId, HttpSession session) {
        checkSession(session);
        SpotifyDto.AudioAnalysis analysis = spotifyService.getAudioAnalysis(trackId);
        if (analysis == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(analysis);
    }

    @GetMapping("/devices")
    public ResponseEntity<List<SpotifyDto.Device>> getDevices(HttpSession session) {
        checkSession(session);
        return ResponseEntity.ok(spotifyService.getDevices());
    }

    @PutMapping("/device")
    public ResponseEntity<?> transferPlayback(@RequestParam String deviceId, HttpSession session) {
        checkSession(session);
        spotifyService.transferPlayback(deviceId, true);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/play")
    public ResponseEntity<?> play(@RequestParam(required = false) String deviceId, HttpSession session) {
        checkSession(session);
        spotifyService.play(deviceId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/pause")
    public ResponseEntity<?> pause(HttpSession session) {
        checkSession(session);
        spotifyService.pause();
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/next")
    public ResponseEntity<?> next(HttpSession session) {
        checkSession(session);
        spotifyService.next();
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/previous")
    public ResponseEntity<?> previous(HttpSession session) {
        checkSession(session);
        spotifyService.previous();
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/seek")
    public ResponseEntity<?> seek(@RequestParam long positionMs, HttpSession session) {
        checkSession(session);
        spotifyService.seek(positionMs);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
