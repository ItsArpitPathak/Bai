package com.bai.backend;

import jakarta.persistence.*;

@Entity
public class AppUser {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(unique = true, nullable = false) public String email;
    @Column(nullable = false) public String passwordHash;
    /** veg | egg | nonveg; null = no preference. */
    public String diet;
    /** Comma-separated foods to avoid, canonical names. */
    public String avoid;
    public Integer householdSize;
}
