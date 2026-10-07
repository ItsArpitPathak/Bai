package com.bai.backend;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class AuthTokenTest {
    @Test
    void liveOnlyBeforeExpiry() {
        var t = new AuthToken();
        var now = Instant.parse("2026-01-01T00:00:00Z");
        assertFalse(t.live(now));
        t.expiresAt = now.plusSeconds(1);
        assertTrue(t.live(now));
        assertFalse(t.live(now.plusSeconds(1)));
    }
}
