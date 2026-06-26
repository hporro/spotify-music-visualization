package com.spotify.visualizer.client;

import com.spotify.visualizer.model.SpotifySession;
import com.spotify.visualizer.service.SpotifyAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
@RequiredArgsConstructor
public class SpotifyApiClient {

    private final HttpServletRequest request;
    private final SpotifyAuthService spotifyAuthService;

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.spotify.com/v1")
            .build();

    public String getAccessToken() {
        HttpSession session = request.getSession(false);
        if (session == null) {
            log.warn("No HTTP session found when trying to get access token");
            return null;
        }

        SpotifySession spotifySession = (SpotifySession) session.getAttribute("spotify_session");
        if (spotifySession == null) {
            log.warn("No SpotifySession found in HTTP session");
            return null;
        }

        if (spotifySession.isExpired()) {
            log.info("Token expired. Refreshing token...");
            SpotifySession refreshed = spotifyAuthService.refreshSession(spotifySession);
            if (refreshed == null) {
                log.error("Failed to refresh Spotify session. Invalidating session.");
                session.removeAttribute("spotify_session");
                return null;
            }
            spotifySession = refreshed;
            session.setAttribute("spotify_session", spotifySession);
        }

        return spotifySession.getAccessToken();
    }

    public <T> T get(String path, Class<T> responseType) {
        String token = getAccessToken();
        if (token == null) {
            throw new IllegalStateException("User not authenticated with Spotify");
        }

        return restClient.get()
                .uri(path)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    if (res.getStatusCode().value() == 403 && (path.contains("audio-features") || path.contains("audio-analysis"))) {
                        log.warn("Spotify API endpoint restricted (403 Forbidden) for path: {}. Frontend will use procedural visualizer fallback.", path);
                    } else {
                        log.error("Spotify API error on GET {}: {} {}", path, res.getStatusCode(), res.getStatusText());
                    }
                })
                .body(responseType);
    }

    public void post(String path, Object body) {
        String token = getAccessToken();
        if (token == null) {
            throw new IllegalStateException("User not authenticated with Spotify");
        }

        restClient.post()
                .uri(path)
                .header("Authorization", "Bearer " + token)
                .body(body != null ? body : "")
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.error("Spotify API error on POST {}: {} {}", path, res.getStatusCode(), res.getStatusText());
                })
                .toBodilessEntity();
    }

    public void put(String path, Object body) {
        String token = getAccessToken();
        if (token == null) {
            throw new IllegalStateException("User not authenticated with Spotify");
        }

        restClient.put()
                .uri(path)
                .header("Authorization", "Bearer " + token)
                .body(body != null ? body : "")
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.error("Spotify API error on PUT {}: {} {}", path, res.getStatusCode(), res.getStatusText());
                })
                .toBodilessEntity();
    }
}
