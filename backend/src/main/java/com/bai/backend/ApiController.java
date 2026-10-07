package com.bai.backend;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@RestController
@CrossOrigin
public class ApiController {
    record Creds(String email, String password) {}
    record NameReq(String name) {}
    record NamesReq(List<String> names) {}
    record TokenResp(String token) {}
    record RecipeReq(String recipeId) {}
    record CheckedReq(boolean checked) {}

    static final Duration TOKEN_TTL = Duration.ofDays(30);

    private final Matcher matcher;
    private final List<Matcher.Recipe> recipes;
    private final List<Map<String, Object>> ingredients;
    private final UserRepo users;
    private final TokenRepo tokens;
    private final PantryRepo pantry;
    private final SavedRepo saved;
    private final ShoppingRepo shopping;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public ApiController(UserRepo users, TokenRepo tokens, PantryRepo pantry, SavedRepo saved, ShoppingRepo shopping) throws Exception {
        this.users = users;
        this.tokens = tokens;
        this.pantry = pantry;
        this.saved = saved;
        this.shopping = shopping;
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
        t.expiresAt = Instant.now().plus(TOKEN_TTL);
        tokens.save(t);
        return new TokenResp(t.token);
    }

    private Long uid(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        var t = tokens.findById(auth.substring(7)).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (t.expiresAt == null) { t.expiresAt = Instant.now().plus(TOKEN_TTL); tokens.save(t); } // pre-expiry token: start its clock now
        else if (!t.live(Instant.now())) { tokens.delete(t); throw new ResponseStatusException(HttpStatus.UNAUTHORIZED); }
        return t.userId;
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
        if (r.name() == null || r.name().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name required");
        return addAll(u, List.of(r.name()));
    }

    /** Pasted lists and guest-pantry merge at login: canonicalize, dedupe, insert. */
    @PostMapping("/pantry/bulk")
    public List<PantryItem> bulk(@RequestHeader(value = "Authorization", required = false) String auth, @RequestBody NamesReq r) {
        return addAll(uid(auth), r.names() == null ? List.of() : r.names());
    }

    private List<PantryItem> addAll(Long u, List<String> names) {
        for (String name : matcher.canonical(names))
            if (!pantry.existsByUserIdAndName(u, name)) {
                var p = new PantryItem();
                p.userId = u;
                p.name = name;
                pantry.save(p);
            }
        return pantry.findByUserIdOrderByName(u);
    }

    /** Lets guests (no pantry on the server) get the same canonical names the pantry stores. */
    @GetMapping("/canonical")
    public List<String> canonical(@RequestParam List<String> names) { return matcher.canonical(names); }

    @DeleteMapping("/pantry/{id}")
    public List<PantryItem> remove(@RequestHeader(value = "Authorization", required = false) String auth, @PathVariable Long id) {
        Long u = uid(auth);
        pantry.findById(id).filter(p -> p.userId.equals(u)).ifPresent(pantry::delete);
        return pantry.findByUserIdOrderByName(u);
    }

    private List<String> savedIds(Long u) { return saved.findByUserId(u).stream().map(x -> x.recipeId).toList(); }

    /** Saved recipes as match results against the user's pantry, so the app can reuse its recipe card. */
    @GetMapping("/saved")
    public List<Matcher.Result> savedList(@RequestHeader(value = "Authorization", required = false) String auth) {
        Long u = uid(auth);
        Set<String> ids = new HashSet<>(savedIds(u));
        var mine = recipes.stream().filter(r -> ids.contains(r.id())).toList();
        return matcher.match(pantry.findByUserIdOrderByName(u).stream().map(p -> p.name).toList(), mine).results();
    }

    @PostMapping("/saved")
    public List<String> save(@RequestHeader(value = "Authorization", required = false) String auth, @RequestBody RecipeReq r) {
        Long u = uid(auth);
        if (recipes.stream().noneMatch(x -> x.id().equals(r.recipeId()))) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!saved.existsByUserIdAndRecipeId(u, r.recipeId())) {
            var s = new SavedRecipe();
            s.userId = u;
            s.recipeId = r.recipeId();
            saved.save(s);
        }
        return savedIds(u);
    }

    @Transactional
    @DeleteMapping("/saved/{recipeId}")
    public List<String> unsave(@RequestHeader(value = "Authorization", required = false) String auth, @PathVariable String recipeId) {
        Long u = uid(auth);
        saved.deleteByUserIdAndRecipeId(u, recipeId);
        return savedIds(u);
    }

    @GetMapping("/shopping")
    public List<ShoppingItem> shoppingList(@RequestHeader(value = "Authorization", required = false) String auth) {
        return shopping.findByUserIdOrderById(uid(auth));
    }

    @PostMapping("/shopping")
    public List<ShoppingItem> shoppingAdd(@RequestHeader(value = "Authorization", required = false) String auth, @RequestBody NamesReq r) {
        Long u = uid(auth);
        for (String name : matcher.canonical(r.names() == null ? List.of() : r.names()))
            if (!shopping.existsByUserIdAndName(u, name)) {
                var i = new ShoppingItem();
                i.userId = u;
                i.name = name;
                shopping.save(i);
            }
        return shopping.findByUserIdOrderById(u);
    }

    @PatchMapping("/shopping/{id}")
    public List<ShoppingItem> shoppingCheck(@RequestHeader(value = "Authorization", required = false) String auth, @PathVariable Long id, @RequestBody CheckedReq r) {
        Long u = uid(auth);
        shopping.findById(id).filter(i -> i.userId.equals(u)).ifPresent(i -> { i.checked = r.checked(); shopping.save(i); });
        return shopping.findByUserIdOrderById(u);
    }

    @DeleteMapping("/shopping/{id}")
    public List<ShoppingItem> shoppingRemove(@RequestHeader(value = "Authorization", required = false) String auth, @PathVariable Long id) {
        Long u = uid(auth);
        shopping.findById(id).filter(i -> i.userId.equals(u)).ifPresent(shopping::delete);
        return shopping.findByUserIdOrderById(u);
    }

    /** Bought it: move checked items into the pantry and off the list. */
    @PostMapping("/shopping/to-pantry")
    public List<ShoppingItem> shoppingToPantry(@RequestHeader(value = "Authorization", required = false) String auth) {
        Long u = uid(auth);
        var done = shopping.findByUserIdOrderById(u).stream().filter(i -> i.checked).toList();
        addAll(u, done.stream().map(i -> i.name).toList());
        shopping.deleteAll(done);
        return shopping.findByUserIdOrderById(u);
    }

    @GetMapping("/ingredients")
    public List<Map<String, Object>> ingredients() { return ingredients; }

    /** Uses ?items= when given (anonymous), otherwise the logged-in user's pantry. */
    @GetMapping("/match")
    public Matcher.Response match(@RequestParam(required = false) List<String> items,
                                  @RequestParam(required = false) String diet,
                                  @RequestParam(required = false) String mealType,
                                  @RequestParam(required = false) Integer maxTime,
                                  @RequestParam(required = false) Integer maxMissing,
                                  @RequestParam(required = false) List<String> include,
                                  @RequestParam(required = false) List<String> exclude,
                                  @RequestHeader(value = "Authorization", required = false) String auth) {
        if (items == null) items = pantry.findByUserIdOrderByName(uid(auth)).stream().map(p -> p.name).toList();
        return matcher.match(items, recipes, new Matcher.Filters(diet, mealType, maxTime, maxMissing, include, exclude));
    }

    @GetMapping("/recipes/{id}")
    public Matcher.Recipe recipe(@PathVariable String id) {
        return recipes.stream().filter(r -> r.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
