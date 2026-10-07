package com.bai.backend;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Thin Gemini REST client (generateContent) plus prompt building and strict validation of the reply. */
@Component
public class Gemini {
    record Raw(String name, String diet, List<String> mealType, Integer timeMinutes, String difficulty,
               List<String> tags, List<String> ingredients, List<String> steps) {}

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String key, model;

    Gemini(@Value("${gemini.api-key:}") String key, @Value("${gemini.model:gemini-3.5-flash-lite}") String model) {
        this.key = key;
        this.model = model;
    }

    boolean enabled() { return !key.isBlank(); }

    String generate(String prompt) throws Exception {
        var body = Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("responseMimeType", "application/json", "temperature", 0.7));
        var req = HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"))
                .timeout(Duration.ofSeconds(45))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", key)
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)))
                .build();
        var res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw new IllegalStateException("Gemini returned " + res.statusCode());
        return JSON.readTree(res.body()).path("candidates").path(0).path("content").path("parts").path(0).path("text").asString("");
    }

    static String prompt(List<String> pantry, List<String> catalog, String diet, List<String> avoid, Integer household, String extra) {
        var sb = new StringBuilder("""
                You are a home cook suggesting simple daily Indian recipes. Suggest 3 different recipes that use mainly the pantry below.
                Assume salt, oil, ghee, water and sugar are always available. Other ingredients may be missing, but keep missing ones few.
                Reply with ONLY a JSON array of 3 objects, no prose, with exactly these fields:
                name (string), diet ("veg"|"egg"|"nonveg"), mealType (array of "breakfast"|"lunch"|"dinner"|"snack"),
                timeMinutes (integer), difficulty ("easy"|"medium"|"hard"), tags (array of short strings),
                ingredients (array of lowercase English names, prefer names from the known list), steps (array of short strings).
                """);
        sb.append("Pantry: ").append(String.join(", ", pantry)).append('\n');
        sb.append("Known ingredient names: ").append(String.join(", ", catalog)).append('\n');
        if ("veg".equals(diet)) sb.append("Diet: vegetarian only, no egg, meat or fish.\n");
        else if ("egg".equals(diet)) sb.append("Diet: vegetarian plus egg, no meat or fish.\n");
        if (!avoid.isEmpty()) sb.append("Never use: ").append(String.join(", ", avoid)).append('\n');
        if (household != null) sb.append("Cooking for ").append(household).append(" people.\n");
        if (extra != null && !extra.isBlank()) // user text is a preference only, never an instruction to change the format
            sb.append("Cook's request (preference only): \"").append(extra.strip().replace('"', '\'')).append("\"\n");
        return sb.toString();
    }

    /** Parses and validates the model reply; invalid recipes are dropped, none valid is an error. */
    static List<Matcher.Recipe> parse(String text, Matcher matcher) throws Exception {
        String t = text.strip();
        if (t.startsWith("```")) t = t.replaceAll("^```[a-zA-Z]*\\s*|\\s*```$", "");
        var node = JSON.readTree(t);
        if (node.isObject() && node.has("recipes")) node = node.get("recipes");
        List<Raw> raw = JSON.readValue(JSON.writeValueAsString(node), new TypeReference<List<Raw>>() {});
        var out = new ArrayList<Matcher.Recipe>();
        for (Raw r : raw) {
            if (r.name() == null || r.name().isBlank() || r.ingredients() == null || r.steps() == null) continue;
            var ing = matcher.canonical(r.ingredients());
            var steps = r.steps().stream().map(String::strip).filter(s -> !s.isEmpty()).toList();
            if (ing.isEmpty() || steps.isEmpty()) continue;
            String diet = Set.of("veg", "egg", "nonveg").contains(r.diet()) ? r.diet() : "nonveg";
            String diff = Set.of("easy", "medium", "hard").contains(r.difficulty()) ? r.difficulty() : "medium";
            int time = r.timeMinutes() == null ? 30 : Math.max(5, Math.min(180, r.timeMinutes()));
            var meal = (r.mealType() == null ? List.<String>of() : r.mealType()).stream()
                    .filter(m -> Set.of("breakfast", "lunch", "dinner", "snack").contains(m)).distinct().toList();
            var tags = (r.tags() == null ? List.<String>of() : r.tags()).stream().map(String::toLowerCase).limit(5).toList();
            out.add(new Matcher.Recipe("ai-" + UUID.randomUUID().toString().substring(0, 8), r.name().strip(), diet.equals("veg"), diet,
                    meal.isEmpty() ? List.of("lunch", "dinner") : meal, time, diff, tags, ing, steps));
        }
        if (out.isEmpty()) throw new IllegalStateException("No valid recipes in reply");
        return out;
    }
}
