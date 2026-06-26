package com.spotify.visualizer.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Controller to forward all non-API, non-WebSocket, and non-file requests
 * back to Angular's index.html so client-side routing works correctly on page refreshes.
 */
@Controller
public class SpaForwardController {

    @RequestMapping(value = {
        "",
        "/",
        "/{path:^(?!api|ws|h2-console)[^\\.]*}"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
