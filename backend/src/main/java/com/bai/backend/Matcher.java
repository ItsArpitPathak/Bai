package com.bai.backend;

import java.util.*;
import java.util.stream.*;

public class Matcher {
    // ponytail: staples assumed always present; make per-user setting if needed
    static final Set<String> STAPLES = Set.of("salt", "oil", "ghee", "water", "sugar");
    public record Recipe(String id, String name, boolean veg, String diet, List<String> mealType, int timeMinutes,
                         String difficulty, List<String> tags, List<String> ingredients, List<String> steps) {}
    public record Result(Recipe recipe, int matchPct, int missingCount, List<String> missing) {}
    /** diet: veg = veg only, egg = veg + egg, anything else = all. Null fields are ignored. */
    public record Filters(String diet, String mealType, Integer maxTime, Integer maxMissing, List<String> include, List<String> exclude) {
        static final Filters NONE = new Filters(null, null, null, null, null, null);
    }
    public record Response(int count, List<Result> results, List<String> suggest) {}

    private final Map<String, String> synonyms;

    public Matcher(Map<String, String> synonyms) { this.synonyms = synonyms; }

    String norm(String s) {
        String k = s.trim().toLowerCase();
        return synonyms.getOrDefault(k, k);
    }

    private Set<String> normAll(List<String> l) {
        return l == null ? Set.of() : l.stream().map(this::norm).collect(Collectors.toSet());
    }

    public Response match(List<String> pantry, List<Recipe> recipes, Filters f) {
        Set<String> have = normAll(pantry), inc = normAll(f.include()), exc = normAll(f.exclude());
        List<Result> results = recipes.stream().filter(r -> allowed(r, f)).map(r -> {
            List<String> all = r.ingredients().stream().map(this::norm).toList();
            if (!all.containsAll(inc) || all.stream().anyMatch(exc::contains)) return null;
            List<String> need = all.stream().filter(i -> !STAPLES.contains(i)).toList();
            List<String> missing = need.stream().filter(i -> !have.contains(i)).toList();
            int pct = need.isEmpty() ? 100 : 100 * (need.size() - missing.size()) / need.size();
            return new Result(r, pct, missing.size(), missing);
        }).filter(x -> x != null && (f.maxMissing() == null || x.missingCount() <= f.maxMissing()))
          .sorted(Comparator.comparingInt(Result::missingCount)
                  .thenComparing(Comparator.comparingInt(Result::matchPct).reversed())
                  .thenComparingInt(x -> x.recipe().timeMinutes())).toList();
        return new Response((int) results.stream().filter(x -> x.missingCount() == 0).count(), results, suggest(results));
    }

    public Response match(List<String> pantry, List<Recipe> recipes) { return match(pantry, recipes, Filters.NONE); }

    private static boolean allowed(Recipe r, Filters f) {
        if ("veg".equals(f.diet()) && !"veg".equals(r.diet())) return false;
        if ("egg".equals(f.diet()) && "nonveg".equals(r.diet())) return false;
        if (f.mealType() != null && !r.mealType().contains(f.mealType())) return false;
        return f.maxTime() == null || r.timeMinutes() <= f.maxTime();
    }

    /** Ingredients missing from the most recipes that are exactly one item short: buy these to unlock the most. */
    static List<String> suggest(List<Result> results) {
        Map<String, Long> n = results.stream().filter(x -> x.missingCount() == 1)
                .collect(Collectors.groupingBy(x -> x.missing().get(0), Collectors.counting()));
        return n.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(10).map(Map.Entry::getKey).toList();
    }
}
