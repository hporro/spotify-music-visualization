package com.spotify.visualizer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class SpotifyDto {

    public record Device(
        String id,
        String name,
        String type,
        @JsonProperty("volume_percent") Integer volumePercent,
        @JsonProperty("is_active") Boolean isActive
    ) {}

    public record Image(
        String url,
        Integer height,
        Integer width
    ) {}

    public record Album(
        String id,
        String name,
        List<Image> images
    ) {}

    public record Artist(
        String id,
        String name
    ) {}

    public record Track(
        String id,
        String name,
        @JsonProperty("duration_ms") Long durationMs,
        Album album,
        List<Artist> artists
    ) {}

    public record PlaybackState(
        Device device,
        @JsonProperty("repeat_state") String repeatState,
        @JsonProperty("shuffle_state") Boolean shuffleState,
        Long timestamp,
        @JsonProperty("progress_ms") Long progressMs,
        @JsonProperty("is_playing") Boolean isPlaying,
        Track item
    ) {}

    public record AudioFeatures(
        String id,
        Float acousticness,
        Float danceability,
        Float energy,
        Float instrumentalness,
        Float liveness,
        Float loudness,
        Float speechiness,
        Float tempo,
        Float valence
    ) {}

    public record TimeInterval(
        Float start,
        Float duration,
        Float confidence
    ) {}

    public record Segment(
        Float start,
        Float duration,
        Float confidence,
        @JsonProperty("loudness_start") Float loudnessStart,
        @JsonProperty("loudness_max_time") Float loudnessMaxTime,
        @JsonProperty("loudness_max") Float loudnessMax,
        @JsonProperty("loudness_end") Float loudnessEnd,
        List<Float> pitches,
        List<Float> timbre
    ) {}

    public record Section(
        Float start,
        Float duration,
        Float confidence,
        Float loudness,
        Float tempo,
        @JsonProperty("tempo_confidence") Float tempoConfidence,
        Integer key,
        @JsonProperty("key_confidence") Float keyConfidence,
        Integer mode,
        @JsonProperty("mode_confidence") Float modeConfidence
    ) {}

    public record AudioAnalysis(
        List<TimeInterval> bars,
        List<TimeInterval> beats,
        List<TimeInterval> tatums,
        List<Section> sections,
        List<Segment> segments
    ) {}
}
