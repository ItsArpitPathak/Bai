package com.bai.backend;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Stream;
import org.slf4j.LoggerFactory;
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
    record Profile(String diet, List<String> avoid, Integer householdSize) {}
    record GenReq(String prompt) {}
    record PlanReq(LocalDate date, String slot, String recipeId) {}
    record PlanView(Long id, LocalDate date, String slot, String recipeId, String recipeName, int timeMinutes) {}

    static final int DAILY_GENERATIONS = 5;
    static final Duration TOKEN_TTL = Duration.ofDays(30);

    private final Matcher matcher;
    private final List<Matcher.Recipe> recipes;
    private final List<Map<String, Object>> ingredients;
    private final UserRepo users;
    private final TokenRepo tokens;
    private final PantryRepo pantry;
    private final SavedRepo saved;
    private final ShoppingRepo shopping;
    private final PlanRepo plan;
    private final Gemini gemini;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public ApiController(UserRepo users, TokenRepo tokens, PantryRepo pantry, SavedRepo saved, ShoppingRepo shopping, PlanRepo plan, Gemini gemini) throws Exception {
        this.users = users;
        this.tokens = tokens;
        this.pantry = pantry;
        this.saved = saved;
        this.shopping = shopping;
        this.plan = plan;
        this.gemini = gemini;
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

    private static List<String> split(String csv) {
        return csv == null || csv.isBlank() ? List.of() : List.of(csv.split(","));
    }

    private Profile profileOf(AppUser u) { return new Profile(u.diet, split(u.avoid), u.householdSize); }

    private AppUser user(Long id) {
        return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    @GetMapping("/profile")
    public Profile profile(@RequestHeader(value = "Authorization", required = false) String auth) {
        return profileOf(user(uid(auth)));
    }

    @PutMapping("/profile")
    public Profile saveProfile(@RequestHeader(value = "Authorization", required = false) String auth, @RequestBody Profile p) {
        var u = user(uid(auth));
        if (p.diet() != null && !Set.of("veg", "egg", "nonveg").contains(p.diet()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "diet must be veg, egg or nonveg");
        if (p.householdSize() != null && (p.householdSize() < 1 || p.householdSize() > 20))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "householdSize must be 1-20");
        u.diet = p.diet();
        u.avoid = String.join(",", matcher.canonical(p.avoid() == null ? List.of() : p.avoid()));
        u.householdSize = p.householdSize();
        return profileOf(users.save(u));
    }

    private List<PlanView> planOf(Long u) {
        return plan.findByUserIdOrderByDate(u).stream().flatMap(e -> recipes.stream().filter(r -> r.id().equals(e.recipeId)).findFirst()
                .map(r -> new PlanView(e.id, e.date, e.slot, e.recipeId, r.name(), r.timeMinutes())).stream()).toList();
    }

    @GetMapping("/plan")
    public List<PlanView> planList(@RequestHeader(value = "Authorization", required = false) String auth) {
        return planOf(uid(auth));
    }

    /** One recipe per date+slot: posting again swaps it. */
    @PostMapping("/plan")
    public List<PlanView> planSet(@RequestHeader(value = "Authorization", required = false) String auth, @RequestBody PlanReq r) {
        Long u = uid(auth);
        if (r.date() == null || !Set.of("breakfast", "lunch", "dinner").contains(r.slot()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date and slot (breakfast, lunch, dinner) required");
        if (recipes.stream().noneMatch(x -> x.id().equals(r.recipeId()))) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var e = plan.findByUserIdAndDateAndSlot(u, r.date(), r.slot()).orElseGet(MealPlanEntry::new);
        e.userId = u;
        e.date = r.date();
        e.slot = r.slot();
        e.recipeId = r.recipeId();
        plan.save(e);
        return planOf(u);
    }

    @DeleteMapping("/plan/{id}")
    public List<PlanView> planRemove(@RequestHeader(value = "Authorization", required = false) String auth, @PathVariable Long id) {
        Long u = uid(auth);
        plan.findById(id).filter(e -> e.userId.equals(u)).ifPresent(plan::delete);
        return planOf(u);
    }

    /** Login required, 5 a day. Returns up to 3 AI recipes (not persisted; ids start with "ai-"). */
    @PostMapping("/generate")
    public List<Matcher.Recipe> generate(@RequestHeader(value = "Authorization", required = false) String auth, @RequestBody(required = false) GenReq r) {
        Long u = uid(auth);
        if (!gemini.enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI generation is not configured");
        var names = pantry.findByUserIdOrderByName(u).stream().map(p -> p.name).toList();
        if (names.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add some ingredients first");
        var me = user(u);
        if (!me.tryGenerate(LocalDate.now(), DAILY_GENERATIONS))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily limit of " + DAILY_GENERATIONS + " AI recipes reached");
        users.save(me); // quota is spent on attempt, so failures cannot be retried in a loop
        var catalog = ingredients.stream().flatMap(c -> ((List<?>) c.get("items")).stream()).map(String::valueOf).toList();
        try {
            String text = gemini.generate(Gemini.prompt(names, catalog, me.diet, split(me.avoid), me.householdSize, r == null ? null : r.prompt()));
            return Gemini.parse(text, matcher);
        } catch (Exception e) {
            LoggerFactory.getLogger(ApiController.class).warn("AI generate failed: {}", e.toString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI could not make recipes right now. Try again later.");
        }
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
        if (items == null) {
            Long u = uid(auth);
            items = pantry.findByUserIdOrderByName(u).stream().map(p -> p.name).toList();
            var me = user(u);
            if (diet == null) diet = me.diet;
            var avoid = split(me.avoid);
            if (!avoid.isEmpty()) exclude = Stream.concat(exclude == null ? Stream.empty() : exclude.stream(), avoid.stream()).toList();
        }
        return matcher.match(items, recipes, new Matcher.Filters(diet, mealType, maxTime, maxMissing, include, exclude));
    }

    @GetMapping("/recipes/{id}")
    public Matcher.Recipe recipe(@PathVariable String id) {
        return recipes.stream().filter(r -> r.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
