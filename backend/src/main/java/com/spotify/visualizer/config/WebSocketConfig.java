package com.spotify.visualizer.config;

import com.spotify.visualizer.websocket.PlayerWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PlayerWebSocketHandler playerWebSocketHandler;

    public WebSocketConfig(PlayerWebSocketHandler playerWebSocketHandler) {
        this.playerWebSocketHandler = playerWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(playerWebSocketHandler, "/ws/player")
                .addInterceptors(new HttpSessionHandshakeInterceptor())
                .setAllowedOrigins("http://localhost:4200");
    }
}
