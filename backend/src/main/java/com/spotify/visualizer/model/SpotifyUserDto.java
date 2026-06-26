package com.spotify.visualizer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record SpotifyUserDto(
    String id,
    @JsonProperty("display_name") String displayName,
    List<Image> images
) {
    public record Image(String url, Integer height, Integer width) {}
}
