package com.spotify.visualizer.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpotifySession implements Serializable {
    private static final long serialVersionUID = 1L;

    private String accessToken;
    private String refreshToken;
    private long expiresAt; // Epoch time in milliseconds when the access token expires
    private String scope;

    public boolean isExpired() {
        // Return true if token expires in less than 10 seconds (buffer for network requests)
        return System.currentTimeMillis() > (expiresAt - 10000);
    }
}
