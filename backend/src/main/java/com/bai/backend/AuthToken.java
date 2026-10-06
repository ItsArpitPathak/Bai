package com.bai.backend;

import jakarta.persistence.*;

@Entity
public class AuthToken {
    @Id public String token;
    public Long userId;
}
