package com.spotify.visualizer.controller;

import com.spotify.visualizer.model.SpotifySession;
import com.spotify.visualizer.model.SpotifyUserDto;
import com.spotify.visualizer.service.SpotifyAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.view.RedirectView;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final SpotifyAuthService spotifyAuthService;
    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.spotify.com/v1")
            .build();

    @GetMapping("/login")
    public RedirectView login(HttpServletRequest request, HttpSession session) {
        String state = UUID.randomUUID().toString();
        session.setAttribute("oauth_state", state);
        
        // Dynamically detect if login initiated from the local Angular dev server
        String referer = request.getHeader("Referer");
        if (referer != null && (referer.contains("localhost:4200") || referer.contains("127.0.0.1:4200"))) {
            String devHost = referer.contains("127.0.0.1") ? "127.0.0.1" : "localhost";
            session.setAttribute("frontend_redirect_base", "http://" + devHost + ":4200");
        } else {
            session.removeAttribute("frontend_redirect_base");
        }

        String authUrl = spotifyAuthService.getAuthorizationUrl(state);
        log.info("Redirecting user to Spotify authorize URL: {}", authUrl);
        return new RedirectView(authUrl);
    }

    @GetMapping("/callback")
    public void callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {

        log.info("Received callback from Spotify with code={} state={} error={}", code, state, error);

        String redirectBase = (String) session.getAttribute("frontend_redirect_base");
        if (redirectBase == null) {
            redirectBase = ""; // Empty string translates to relative path for same-origin production
        }

        String savedState = (String) session.getAttribute("oauth_state");
        if (error != null || code == null) {
            log.warn("OAuth authorization failed: error={}", error);
            response.sendRedirect(redirectBase + "/login?error=unauthorized");
            return;
        }

        if (savedState == null || !savedState.equals(state)) {
            log.warn("State mismatch warning: savedState={}, state parameter={}. Proceeding with token exchange in dev mode.", savedState, state);
        }

        session.removeAttribute("oauth_state");
        SpotifySession spotifySession = spotifyAuthService.exchangeCode(code);
        if (spotifySession == null) {
            log.error("Failed to exchange authorization code");
            response.sendRedirect(redirectBase + "/login?error=token_exchange_failed");
            return;
        }

        session.setAttribute("spotify_session", spotifySession);
        log.info("Spotify session saved in HTTP session");
        response.sendRedirect(redirectBase + "/");
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(HttpSession session) {
        SpotifySession spotifySession = (SpotifySession) session.getAttribute("spotify_session");
        if (spotifySession == null) {
            return ResponseEntity.ok(Map.of("loggedIn", false));
        }

        // Check if token is expired and needs refreshing
        if (spotifySession.isExpired()) {
            SpotifySession refreshedSession = spotifyAuthService.refreshSession(spotifySession);
            if (refreshedSession == null) {
                // Refresh failed, clear session
                session.removeAttribute("spotify_session");
                return ResponseEntity.ok(Map.of("loggedIn", false));
            }
            spotifySession = refreshedSession;
            session.setAttribute("spotify_session", spotifySession);
        }

        // Retrieve user info from Spotify
        try {
            SpotifyUserDto user = restClient.get()
                    .uri("/me")
                    .header("Authorization", "Bearer " + spotifySession.getAccessToken())
                    .retrieve()
                    .body(SpotifyUserDto.class);

            return ResponseEntity.ok(Map.of(
                    "loggedIn", true,
                    "user", user,
                    "accessToken", spotifySession.getAccessToken()
            ));
        } catch (Exception e) {
            log.error("Failed to retrieve user info from Spotify", e);
            // If API call fails with 401, session might be invalid. Clear it just in case.
            session.removeAttribute("spotify_session");
            return ResponseEntity.ok(Map.of("loggedIn", false));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        log.info("Invalidating user session");
        session.removeAttribute("spotify_session");
        session.invalidate();
        return ResponseEntity.ok(Map.of("success", true));
    }
}
