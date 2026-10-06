package com.bai.backend;

import java.util.*;
import java.util.stream.*;

public class Matcher {
    // ponytail: staples assumed always present; make per-user setting if needed
    static final Set<String> STAPLES = Set.of("salt", "oil", "ghee", "water", "sugar");
    public record Recipe(String name, boolean veg, List<String> ingredients, List<String> steps) {}
    public record Result(Recipe recipe, int matchPct, List<String> missing) {}

    private final Map<String, String> synonyms;

    public Matcher(Map<String, String> synonyms) { this.synonyms = synonyms; }

    String norm(String s) {
        String k = s.trim().toLowerCase();
        return synonyms.getOrDefault(k, k);
    }

    public List<Result> match(List<String> pantry, List<Recipe> recipes) {
        Set<String> have = pantry.stream().map(this::norm).collect(Collectors.toSet());
        return recipes.stream().map(r -> {
            List<String> need = r.ingredients().stream().map(this::norm).filter(i -> !STAPLES.contains(i)).toList();
            List<String> missing = need.stream().filter(i -> !have.contains(i)).toList();
            int pct = need.isEmpty() ? 100 : 100 * (need.size() - missing.size()) / need.size();
            return new Result(r, pct, missing);
        }).sorted(Comparator.comparingInt(Result::matchPct).reversed()).toList();
    }
}
