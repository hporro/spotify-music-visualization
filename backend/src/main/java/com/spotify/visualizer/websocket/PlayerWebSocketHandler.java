package com.spotify.visualizer.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spotify.visualizer.model.SpotifyDto;
import com.spotify.visualizer.model.SpotifySession;
import com.spotify.visualizer.service.SpotifyAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class PlayerWebSocketHandler extends TextWebSocketHandler {

    private final SpotifyAuthService spotifyAuthService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.spotify.com/v1")
            .build();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket connection established: {}", session.getId());
        sessions.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("WebSocket connection closed: {}", session.getId());
        sessions.remove(session.getId());
    }

    @Scheduled(fixedDelay = 1500)
    public void pollAndBroadcast() {
        if (sessions.isEmpty()) {
            return;
        }

        for (WebSocketSession session : sessions.values()) {
            if (!session.isOpen()) {
                continue;
            }

            try {
                // Retrieve spotify session copied from HTTP session
                SpotifySession spotifySession = (SpotifySession) session.getAttributes().get("spotify_session");
                if (spotifySession == null) {
                    continue;
                }

                // Check and refresh token if expired
                if (spotifySession.isExpired()) {
                    SpotifySession refreshed = spotifyAuthService.refreshSession(spotifySession);
                    if (refreshed != null) {
                        spotifySession = refreshed;
                        session.getAttributes().put("spotify_session", spotifySession);
                    } else {
                        // Refresh failed, send unauthorized and close
                        session.sendMessage(new TextMessage("{\"error\":\"unauthorized\"}"));
                        session.close(CloseStatus.POLICY_VIOLATION);
                        continue;
                    }
                }

                // Fetch playback state from Spotify
                SpotifyDto.PlaybackState state = fetchPlaybackState(spotifySession.getAccessToken());
                
                // Send state to client as JSON (or empty message if null)
                String json = state != null ? objectMapper.writeValueAsString(state) : "{}";
                session.sendMessage(new TextMessage(json));

            } catch (Exception e) {
                log.error("Error polling/broadcasting in WebSocket session: {}", session.getId(), e);
            }
        }
    }

    private SpotifyDto.PlaybackState fetchPlaybackState(String accessToken) {
        try {
            return restClient.get()
                    .uri("/me/player")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        // ignore or log
                    })
                    .body(SpotifyDto.PlaybackState.class);
        } catch (Exception e) {
            return null;
        }
    }
}
