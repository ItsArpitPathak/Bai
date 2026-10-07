package com.bai.backend;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class MatcherTest {
    static Matcher.Recipe rec(String id, String diet, int time, List<String> meal, String... ing) {
        return new Matcher.Recipe(id, id, diet.equals("veg"), diet, meal, time, "easy", List.of(), List.of(ing), List.of());
    }

    final Matcher m = new Matcher(Map.of("aloo", "potato", "pyaaz", "onion"));
    final Matcher.Recipe a = rec("A", "veg", 30, List.of("lunch"), "potato", "onion", "salt");
    final Matcher.Recipe b = rec("B", "veg", 10, List.of("breakfast"), "rice", "onion");
    final Matcher.Recipe c = rec("C", "nonveg", 20, List.of("dinner"), "chicken", "onion", "potato");
    final Matcher.Recipe d = rec("D", "egg", 5, List.of("breakfast"), "egg", "onion");

    static List<String> ids(Matcher.Response r) { return r.results().stream().map(x -> x.recipe().id()).toList(); }

    @Test
    void canonicalizesAndDedupes() {
        assertEquals(List.of("potato", "onion", "rice"), m.canonical(List.of("Aloo", " potato ", "pyaaz", "", "Rice")));
    }

    @Test
    void ranksAndNormalizes() {
        var r = m.match(List.of("Aloo", "pyaaz"), List.of(b, a)).results();
        assertEquals("A", r.get(0).recipe().name());
        assertEquals(100, r.get(0).matchPct());
        assertEquals(0, r.get(0).missingCount());
        assertEquals(50, r.get(1).matchPct());
        assertEquals(List.of("rice"), r.get(1).missing());
    }

    @Test
    void sortsByMissingThenPctThenTime() {
        // B, D, A each miss 1 (A misses potato, 50%); C misses 2. Equal missing and pct -> shorter time first.
        assertEquals(List.of("D", "B", "A", "C"), ids(m.match(List.of("onion"), List.of(a, b, c, d))));
    }

    @Test
    void filtersCombine() {
        var all = List.of(a, b, c, d);
        assertEquals(List.of("D"), ids(m.match(List.of("onion"), all, new Matcher.Filters("egg", "breakfast", 8, 1, null, null))));
        var veg = ids(m.match(List.of("onion"), all, new Matcher.Filters("veg", null, null, null, null, null)));
        assertEquals(List.of("B", "A"), veg);
        assertEquals(List.of("A"), ids(m.match(List.of("onion"), all, new Matcher.Filters(null, null, null, null, List.of("Aloo"), List.of("chicken")))));
    }

    @Test
    void countsReadyAndSuggestsMostUnlocking() {
        var e = rec("E", "veg", 10, List.of("lunch"), "potato", "onion");
        assertEquals(0, m.match(List.of("onion"), List.of(a, b, c, d, e)).count());
        var r = m.match(List.of("onion", "potato"), List.of(a, b, c, d, e));
        assertEquals(2, r.count());
        assertEquals(List.of("chicken", "egg", "rice"), r.suggest());
    }
}
