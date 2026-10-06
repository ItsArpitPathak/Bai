package com.bai.backend;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class MatcherTest {
    @Test
    void ranksAndNormalizes() {
        var m = new Matcher(Map.of("aloo", "potato", "pyaaz", "onion"));
        var a = new Matcher.Recipe("A", true, List.of("potato", "onion", "salt"), List.of());
        var b = new Matcher.Recipe("B", true, List.of("rice", "onion"), List.of());
        var r = m.match(List.of("Aloo", "pyaaz"), List.of(b, a));
        assertEquals("A", r.get(0).recipe().name());
        assertEquals(100, r.get(0).matchPct());
        assertEquals(50, r.get(1).matchPct());
        assertEquals(List.of("rice"), r.get(1).missing());
    }
}
