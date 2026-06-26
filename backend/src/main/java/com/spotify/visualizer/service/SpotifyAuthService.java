package com.spotify.visualizer.service;

import com.spotify.visualizer.model.SpotifySession;
import com.spotify.visualizer.model.SpotifyTokenResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Slf4j
@Service
public class SpotifyAuthService {

    @Value("${spotify.client-id}")
    private String clientId;

    @Value("${spotify.client-secret}")
    private String clientSecret;

    @Value("${spotify.redirect-uri}")
    private String redirectUri;

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://accounts.spotify.com")
            .build();

    private String getRedirectUri() {
        try {
            return org.springframework.web.servlet.support.ServletUriComponentsBuilder
                    .fromCurrentContextPath()
                    .path("/api/auth/callback")
                    .build()
                    .toUriString();
        } catch (Exception e) {
            return redirectUri;
        }
    }

    public String getAuthorizationUrl(String state) {
        String scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state user-read-private streaming user-read-email";
        return UriComponentsBuilder.fromUriString("https://accounts.spotify.com/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("scope", scope)
                .queryParam("redirect_uri", getRedirectUri())
                .queryParam("state", state)
                .build()
                .toUriString();
    }

    public SpotifySession exchangeCode(String code) {
        log.info("Exchanging auth code for tokens");
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("code", code);
        body.add("redirect_uri", getRedirectUri());

        return executeTokenRequest(body);
    }

    public SpotifySession refreshSession(SpotifySession session) {
        log.info("Refreshing Spotify access token");
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "refresh_token");
        body.add("refresh_token", session.getRefreshToken());

        SpotifySession refreshed = executeTokenRequest(body);
        if (refreshed != null) {
            // Spotify token refresh might not return a new refresh token. If it is null, keep the old one.
            if (refreshed.getRefreshToken() == null) {
                refreshed.setRefreshToken(session.getRefreshToken());
            }
            return refreshed;
        }
        return null;
    }

    private SpotifySession executeTokenRequest(MultiValueMap<String, String> body) {
        String authHeader = "Basic " + Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        try {
            SpotifyTokenResponse response = restClient.post()
                    .uri("/api/token")
                    .header("Authorization", authHeader)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(body)
                    .retrieve()
                    .body(SpotifyTokenResponse.class);

            if (response != null) {
                long expiresAt = System.currentTimeMillis() + (response.expiresIn() * 1000L);
                return SpotifySession.builder()
                        .accessToken(response.accessToken())
                        .refreshToken(response.refreshToken())
                        .expiresAt(expiresAt)
                        .scope(response.scope())
                        .build();
            }
        } catch (Exception e) {
            log.error("Failed to execute Spotify token request", e);
        }
        return null;
    }
}
