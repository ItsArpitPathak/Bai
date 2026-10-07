package com.bai.backend;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
public class AuthToken {
    @Id public String token;
    public Long userId;
    /** Null only for tokens issued before expiry existed; ApiController stamps them on first use. */
    public Instant expiresAt;

    boolean live(Instant now) { return expiresAt != null && expiresAt.isAfter(now); }
}
