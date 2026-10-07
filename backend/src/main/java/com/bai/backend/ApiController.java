package com.bai.backend;

import java.io.InputStream;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@RestController
@CrossOrigin
public class ApiController {
    record Creds(String email, String password) {}
    record NameReq(String name) {}
    record TokenResp(String token) {}

    private final Matcher matcher;
    private final List<Matcher.Recipe> recipes;
    private final List<Map<String, Object>> ingredients;
    private final UserRepo users;
    private final TokenRepo tokens;
    private final PantryRepo pantry;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public ApiController(UserRepo users, TokenRepo tokens, PantryRepo pantry) throws Exception {
        this.users = users;
        this.tokens = tokens;
        this.pantry = pantry;
        var m = JsonMapper.builder().build();
        try (InputStream s = getClass().getResourceAsStream("/data/synonyms.json");
             InputStream r = getClass().getResourceAsStream("/data/recipes.json");
             InputStream i = getClass().getResourceAsStream("/data/ingredients.json")) {
            matcher = new Matcher(m.readValue(s, new TypeReference<Map<String, String>>() {}));
            recipes = m.readValue(r, new TypeReference<List<Matcher.Recipe>>() {});
            ingredients = m.readValue(i, new TypeReference<List<Map<String, Object>>>() {});
        }
    }

    private TokenResp issue(Long userId) {
        var t = new AuthToken();
        t.token = UUID.randomUUID().toString();
        t.userId = userId;
        tokens.save(t);
        return new TokenResp(t.token);
    }

    // ponytail: opaque tokens never expire; add expiry column if sessions must lapse
    private Long uid(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return tokens.findById(auth.substring(7)).map(t -> t.userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    @PostMapping("/auth/register")
    public TokenResp register(@RequestBody Creds c) {
        if (c.email() == null || !c.email().contains("@") || c.password() == null || c.password().length() < 6)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid email and 6+ char password required");
        String email = c.email().trim().toLowerCase();
        if (users.findByEmail(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        var u = new AppUser();
        u.email = email;
        u.passwordHash = enc.encode(c.password());
        return issue(users.save(u).id);
    }

    @PostMapping("/auth/login")
    public TokenResp login(@RequestBody Creds c) {
        var u = users.findByEmail(c.email() == null ? "" : c.email().trim().toLowerCase())
                .filter(x -> c.password() != null && enc.matches(c.password(), x.passwordHash))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Wrong email or password"));
        return issue(u.id);
    }

    @GetMapping("/pantry")
    public List<PantryItem> list(@RequestHeader(value = "Authorization", required = false) String auth) {
        return pantry.findByUserIdOrderByName(uid(auth));
    }

    @PostMapping("/pantry")
    public List<PantryItem> add(@RequestHeader(value = "Authorization", required = false) String auth, @RequestBody NameReq r) {
        Long u = uid(auth);
        String name = r.name() == null ? "" : r.name().trim().toLowerCase();
        if (name.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name required");
        if (!pantry.existsByUserIdAndName(u, name)) {
            var p = new PantryItem();
            p.userId = u;
            p.name = name;
            pantry.save(p);
        }
        return pantry.findByUserIdOrderByName(u);
    }

    @DeleteMapping("/pantry/{id}")
    public List<PantryItem> remove(@RequestHeader(value = "Authorization", required = false) String auth, @PathVariable Long id) {
        Long u = uid(auth);
        pantry.findById(id).filter(p -> p.userId.equals(u)).ifPresent(pantry::delete);
        return pantry.findByUserIdOrderByName(u);
    }

    @GetMapping("/ingredients")
    public List<Map<String, Object>> ingredients() { return ingredients; }

    /** Uses ?items= when given (anonymous), otherwise the logged-in user's pantry. */
    @GetMapping("/match")
    public List<Matcher.Result> match(@RequestParam(required = false) List<String> items,
                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        if (items == null) items = pantry.findByUserIdOrderByName(uid(auth)).stream().map(p -> p.name).toList();
        return matcher.match(items, recipes);
    }
}
