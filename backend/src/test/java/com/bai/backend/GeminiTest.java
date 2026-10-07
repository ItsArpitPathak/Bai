package com.bai.backend;

import static org.junit.jupiter.api.Assertions.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;

class GeminiTest {
    final Matcher m = new Matcher(Map.of("aloo", "potato"));

    @Test
    void parsesFencedJsonAndDropsInvalid() throws Exception {
        String reply = """
                ```json
                [{"name":"Jeera Aloo","diet":"veg","mealType":["lunch","brunch"],"timeMinutes":9999,"difficulty":"easy","tags":["Dry"],
                  "ingredients":["Aloo","cumin","aloo"],"steps":["Boil","Fry"]},
                 {"name":"","ingredients":["x"],"steps":["y"]},
                 {"name":"No steps","ingredients":["x"],"steps":[]}]
                ```""";
        var r = Gemini.parse(reply, m);
        assertEquals(1, r.size());
        var x = r.get(0);
        assertEquals(List.of("potato", "cumin"), x.ingredients());
        assertEquals(List.of("lunch"), x.mealType());
        assertEquals(180, x.timeMinutes());
        assertTrue(x.veg());
        assertTrue(x.id().startsWith("ai-"));
    }

    @Test
    void rejectsGarbageAndEmpty() {
        assertThrows(Exception.class, () -> Gemini.parse("sorry, I can't", m));
        assertThrows(IllegalStateException.class, () -> Gemini.parse("[]", m));
    }

    @Test
    void dailyLimitResetsNextDay() {
        var u = new AppUser();
        var day = LocalDate.of(2026, 10, 7);
        for (int i = 0; i < 5; i++) assertTrue(u.tryGenerate(day, 5));
        assertFalse(u.tryGenerate(day, 5));
        assertTrue(u.tryGenerate(day.plusDays(1), 5));
    }
}
