package com.bai.backend;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

class DataTest {
    @Test
    void everyRecipeIngredientIsInExactlyOneCategory() throws Exception {
        var m = JsonMapper.builder().build();
        var matcher = new Matcher(m.readValue(getClass().getResourceAsStream("/data/synonyms.json"), new TypeReference<Map<String, String>>() {}));
        var recipes = m.readValue(getClass().getResourceAsStream("/data/recipes.json"), new TypeReference<List<Matcher.Recipe>>() {});
        var cats = m.readValue(getClass().getResourceAsStream("/data/ingredients.json"), new TypeReference<List<Map<String, Object>>>() {});
        Map<String, Integer> count = new HashMap<>();
        for (var c : cats) for (Object i : (List<?>) c.get("items")) count.merge((String) i, 1, Integer::sum);
        Set<String> ids = new HashSet<>();
        for (var r : recipes) {
            assertTrue(ids.add(r.id()), "duplicate id " + r.id());
            assertTrue(Set.of("veg", "egg", "nonveg").contains(r.diet()), r.id());
            assertTrue(Set.of("easy", "medium", "hard").contains(r.difficulty()), r.id());
            assertTrue(r.timeMinutes() > 0 && !r.mealType().isEmpty() && !r.tags().isEmpty(), r.id());
            assertEquals(r.veg(), r.diet().equals("veg"), r.id());
        }
        for (var r : recipes) for (String i : r.ingredients()) {
            String n = matcher.norm(i);
            if (!Matcher.STAPLES.contains(n)) assertEquals(1, count.getOrDefault(n, 0), r.name() + ": " + n);
        }
        count.forEach((k, v) -> assertEquals(1, v, "duplicate " + k));
    }
}
