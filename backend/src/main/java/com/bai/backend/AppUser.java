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
    /** AI-generation quota: count of /generate calls on genDay (nullable for pre-existing rows). */
    public java.time.LocalDate genDay;
    public Integer genCount;

    /** Consumes one generation if today's quota allows it. */
    boolean tryGenerate(java.time.LocalDate today, int max) {
        if (!today.equals(genDay)) { genDay = today; genCount = 0; }
        if (genCount != null && genCount >= max) return false;
        genCount = (genCount == null ? 0 : genCount) + 1;
        return true;
    }
}
