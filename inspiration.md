# inspiration.md — Bai: layout and implementation plan

> **For the coding agent:** This is the design and implementation brief for **Bai** (repo `github.com/ItsArpitPathak/Bai`).
> Read it together with the project handoff file. It describes **what to change from the current state (master `cb237a0`)** to reach the target design.
> The design borrows interaction patterns from **Supercook** (pantry-based recipe search) and **DishGen** (AI recipe generation, landing page polish).
> **Do not copy either site's name, logo, colors, illustrations, copy or images.** Borrow layout and interaction patterns only.

## 0. Hard constraints (do not break)
- **Free tier only** (Render, Neon, Vercel, EAS, any LLM API).
- Cuisine: **simple daily Indian home cooking**. Hindi synonyms are a core feature.
- One codebase for web and Android: Expo SDK ~57, React Native + react-native-web, TypeScript.
- Backend: Spring Boot 4.1.1 (Jackson 3, `tools.jackson.*`), Java 21, Maven wrapper only, JPA, BCrypt only.
- Dev machine: Windows 11 + PowerShell 5.1. No `&&`; use `;`, `npx.cmd`, `.\mvnw.cmd`.
- Workflow: small PR per phase. Branch, push, `gh pr create`, wait for the user to say "merge it", check CI is green, then `gh pr merge N --squash --delete-branch`.
- Style: minimal code, diffs over rewrites, terse replies.
- Never put secrets in the repo (Neon or LLM keys live only in Render env vars).

---

## 1. Current state vs target

| Area | Today | Target |
|---|---|---|
| Entry | Login/register first | Guest mode; web landing page for first visit; login only to save/plan/generate |
| Pantry input | Text input + `QUICK` chips | Category cards with toggle chips, counters, "+N more", paste-a-list input |
| Results | Filter toggle All/Veg/Ready now + cards with match bar | Live "You can make N" headline, "Do you have?" suggestions, filter pills, richer cards |
| Recipe view | Inline expand of steps | Detail screen + cooking mode |
| Navigation | Single `App.tsx`, no router | `expo-router`, split into `src/` files, responsive shell |
| Data | 169 recipes: name, veg, ingredients[], steps[] | + id, mealType, timeMinutes, difficulty, tags, diet; ingredient catalog with categories |
| Extras | — | Saved, shopping list, meal plan, profile, token expiry, optional AI generate |

**Keep as-is:** the Matcher concept (synonyms, staples ignored), match bar colors (green 100 / amber ≥50 / grey), light/dark mode, the "Server is waking up (free hosting)…" message, the API URL handling.

---

## 2. Patterns borrowed

### From Supercook
- Two-panel layout: **Pantry (left)** + **Results (right)**, each scrolling on its own.
- **Category cards** with an icon, a `3/40` counter, the top ~10 chips and a `+N more` chip.
- **Tap-to-toggle chips** (grey = off, green + ✓/× = on).
- One input that **adds, removes or pastes a list**.
- **Live count**: "You can make 42 recipes", updating on every toggle.
- **"Do you have?"** chips: ingredients that unlock the most extra recipes.
- **Filter pills**, including "Missing 1".
- **Match line** on cards: "You have all 5" / "Missing 1: paneer".
- Empty state: "Add ingredients to get started. Every ingredient unlocks more recipes."
- Tip: "We assume salt, oil, ghee, water, sugar" (this matches Bai's staples list).

### From DishGen
- Web **hero with one big input box** that starts the product directly.
- Rotating example under the box; reassurance line "Free · no login needed".
- Feature sections that alternate text and screenshot.
- **Structured recipe card**: meta row (time · difficulty · diet), ingredients and numbered steps, tags, save.
- **Profile**: diet, foods to avoid, household size.
- **Meal planner** with swap/regenerate per slot.
- Cookie/notice banners (if any) use equal-weight Accept/Deny buttons.

### Dropped or adapted for Bai
- **Dropped:** pricing page and tiers, ads, press logos, external recipe links, language picker, public SEO recipe library (an Expo web app is a single page, so SEO gains would be small).
- **Adapted:**
  - Cuisine filter becomes **meal type + tags** (dal, sabzi, roti, rice, tiffin, quick).
  - "Free / no card" becomes **"Free · no login needed"**.
  - The AI chef becomes **one "✨ Generate with AI" button** on results, not a chat screen.
  - Servings stepper waits until ingredient quantities exist.
  - No recipe photos: use a **colored tile with an emoji or initials** per dish type.

---

## 3. Backend changes (`backend/`)

### 3.1 Data
**`recipes.json`**: add fields to all 169 recipes:
```json
{
  "id": "aloo-gobi",
  "name": "Aloo Gobi",
  "diet": "veg",
  "mealType": ["lunch", "dinner"],
  "timeMinutes": 30,
  "difficulty": "easy",
  "tags": ["sabzi", "dry", "quick"],
  "ingredients": ["potato", "cauliflower", "onion", "tomato", "turmeric", "cumin"],
  "steps": ["…"]
}
```
- `diet`: `veg | egg | nonveg` (replaces the boolean `veg`; keep `veg` derivable for old clients during migration).
- `mealType`: any of `breakfast | lunch | dinner | snack`.
- `difficulty`: `easy | medium | hard`.

**New `ingredients.json`** (ingredient catalog for the pantry cards):
```json
[
  { "category": "Atta & Grains", "icon": "🌾", "items": ["wheat flour", "rice", "gram flour", "semolina", "poha", "…"] },
  { "category": "Dal & Pulses",  "icon": "🫘", "items": ["toor dal", "moong dal", "chana", "rajma", "…"] },
  { "category": "Masale",        "icon": "🌶️", "items": ["turmeric", "cumin", "red chilli powder", "garam masala", "…"] },
  { "category": "Sabzi",         "icon": "🥔", "items": ["potato", "onion", "tomato", "…"] },
  { "category": "Dairy",         "icon": "🥛", "items": ["milk", "curd", "paneer", "butter", "…"] },
  { "category": "Fruits",        "icon": "🍌", "items": ["…"] },
  { "category": "Meat & Eggs",   "icon": "🥚", "items": ["egg", "chicken", "…"] },
  { "category": "Sauces & Others","icon": "🫙", "items": ["…"] }
]
```
- Items use **canonical English names** (the same ones the Matcher normalizes to). Order by how common they are; the UI shows the first ~10.
- Every ingredient used in `recipes.json` must appear in exactly one category. Add a test that checks this.

### 3.2 Endpoints
| Endpoint | Change |
|---|---|
| `GET /ingredients` | **New.** Returns `ingredients.json`. Public. |
| `GET /match` | **Changed.** New query params: `diet`, `mealType`, `maxTime`, `maxMissing`, `include` (csv), `exclude` (csv). Response becomes `{count, results[], suggest[]}`. Each result gains `missingCount` and the recipe gains its new fields + `id`. Sort: `missingCount ASC`, then `matchPct DESC`, then `timeMinutes ASC`. `count` = results with `missingCount == 0` after filters. |
| `GET /recipes/{id}` | **New.** Single recipe (for the detail screen and deep links). |
| `POST /pantry/bulk {names[]}` | **New.** Canonicalize each name through synonyms, dedupe, insert. Used for pasted lists and for merging a guest pantry at login. |
| `GET/POST/DELETE /saved` | **New.** `SavedRecipe {id, userId, recipeId}`. |
| `GET/POST/PATCH/DELETE /shopping` | **New.** `ShoppingItem {id, userId, name, checked}`. Plus `POST /shopping/to-pantry` to move checked items into the pantry. |
| `GET/PUT /profile` | **New.** Fields on `AppUser` or a `UserProfile` entity: `diet`, `avoid[]`, `householdSize`. `/match` applies diet and avoid automatically for logged-in users. |
| `GET/POST/DELETE /plan` | **New.** `MealPlanEntry {id, userId, date, slot, recipeId}`. |
| `POST /generate` | **Optional, last phase.** See 3.4. |

**`suggest[]` logic (Matcher):** among filtered recipes with `missingCount == 1`, count how often each missing ingredient appears; return the top 10 names. Pure function, unit-tested.

### 3.3 Auth
- Add `expiresAt` to `AuthToken` (e.g. 30 days). Check it on every auth lookup; return 401 when expired. The app already handles 401 by logging out.

### 3.4 AI generate (optional)
- `POST /generate {pantry[], prompt?}` calls a **free-tier LLM API** (e.g. Gemini or Groq). Free limits change, so check current terms before building.
- API key only in a Render env var. Limit each user to ~5 generations a day (store a counter on the user). Login required.
- The prompt asks for **strict JSON in the `recipes.json` shape**, simple Indian home cooking, using mainly the given pantry. Validate the JSON server-side; reject anything invalid.
- Generated recipes are returned, not added to `recipes.json`. They can be saved with `source: "ai"` stored in a `UserRecipe` table.

### 3.5 Tests
- Extend `MatcherTest`: filters, sort order, `missingCount`, `suggest`, synonym canonicalization in bulk add.
- Data test: every recipe has the new fields; every recipe ingredient exists in `ingredients.json`.
- Keep avoiding Spring Boot 4 MockMvc/test-slice packages (they moved).

---

## 4. App changes (`app/`)

### 4.1 Structure
```
app/
  app/                      ← expo-router routes
    _layout.tsx             theme provider, auth/guest context, responsive shell
    index.tsx               web: landing (first visit, logged out) | native: redirect to /kitchen
    kitchen.tsx             Pantry + Results
    recipe/[id].tsx         Recipe detail (+ cooking mode)
    saved.tsx  list.tsx  plan.tsx  profile.tsx  login.tsx
  src/
    theme.ts                tokens (light/dark)
    api.ts                  fetch wrapper (existing API URL logic, waking-up message, 401 handling)
    store.ts                pantry state, guest persistence, merge on login
    components/             IngredientChip, CategoryCard, PantryInput, FilterPill, FilterSheet,
                            RecipeCard, MatchLine, SuggestChips, EmptyState, BottomTabs, HeroInput
```
- Move logic out of `App.tsx` with **no visible change** in the first PR.
- Keep AsyncStorage for the token and the guest pantry.

### 4.2 Guest mode
- Opening the app goes straight to `/kitchen`; no login wall.
- Guest pantry is stored in AsyncStorage and sent to anonymous `GET /match?items=…`.
- On login/register: `POST /pantry/bulk` with the guest pantry, then clear the local copy.
- Login is requested only when the user saves, adds to plan/list, or generates.

### 4.3 Responsive shell
| Width | Layout |
|---|---|
| < 768px | One screen at a time; **bottom tabs**: `Pantry` · `Recipes (N)` · `Plan` · `List` · `Me`. Filters open in a bottom sheet. |
| 768–1023px | Pantry in a slide-out drawer (header button); results full width. |
| ≥ 1024px | **Two panels**: Pantry (320px) + Results, each its own `ScrollView`. Cards in 2 columns (3 at ≥ 1440px). |

### 4.4 Kitchen screen wireframe (desktop)
```
┌──────── PANTRY (320px) ────────────────┬──────────── RESULTS ───────────────────────────────┐
│ Pantry · 7 items                  A–Z  │ (Veg)(Ready now)(Meal type)(≤30 min)(Missing 1)    │
│ [ Add: aloo, pyaaz, tamatar…        ]  │ (Include)(Exclude)                                 │
│ ⓘ We assume salt, oil, ghee,      ✕    │                                                    │
│   water, sugar                         │ You can make 42 recipes                            │
│ Selected: [aloo ×][pyaaz ×][jeera ×]   │ Do you have?  [paneer][curd][besan][+ more]        │
│ ┌ 🌾 Atta & Grains     2/18 ▾ ┐         │                                                    │
│ │ [atta●][rice●][besan][suji]  │        │ ┌card┐ ┌card┐                                     │
│ │ [poha][+8 more]              │        │ ┌card┐ ┌card┐   …                                │
│ └──────────────────────────────┘        │                                                    │
│ ┌ 🫘 Dal & Pulses      0/15 ▾ ┐         │ ✨ Nothing you like? [Generate with AI] (optional) │
│ ┌ 🌶️ Masale  ┐ ┌ 🥔 Sabzi ┐ …           │                                                    │
│ [Clear pantry]                         │                                                    │
└────────────────────────────────────────┴────────────────────────────────────────────────────┘
```
- Pantry input accepts Hindi or English, comma or newline separated. Unknown names are still added (shown with a dashed outline).
- Toggling a chip updates state, re-queries `/match` (debounce 250ms) and animates the count.
- Filter pills replace the current All/Veg/Ready-now toggle. "Ready now" = `maxMissing=0`; "Missing 1" = `maxMissing=1`.
- Empty pantry shows the empty state instead of results.

### 4.5 Recipe card
```
┌──────┬──────────────────────────────────────────┐
│  🍛  │ Aloo Gobi                            ♡    │
│ tile │ ⏱ 30 min · Easy · 🟢 Veg                  │
│      │ ✅ You have all 5                          │
│      │   or  ⚠ Missing 1: paneer  [+ list]       │
│      │ ▓▓▓▓▓▓▓▓░░ 80%  (existing match bar)      │
└──────┴──────────────────────────────────────────┘
```
- Tile color and emoji come from the first tag (dal 🫘, sabzi 🥔, roti 🫓, rice 🍚, snack 🥟, sweet 🍮).
- Tapping the card opens `/recipe/[id]`.

### 4.6 Recipe detail `/recipe/[id]`
- Header: tile, name, ♡ Save.
- Meta row: ⏱ time · difficulty · diet · meal type.
- **Ingredients**, each marked ✅ have / ❌ missing; button "Add missing to list".
- **Steps**, numbered.
- Two columns (ingredients | steps) at ≥ 768px.
- **Cooking mode** button: full screen, one step at a time, large text, Prev/Next, screen kept awake with `expo-keep-awake`.
- Buttons: Add to plan · Share (web: copy link).

### 4.7 Landing page `/` (web only, first visit, logged out)
```
HERO   "What's in your kitchen today?"
       [ aloo, pyaaz, tamatar…                     ] [Find recipes →]
       Try: "besan, dahi, jeera" (rotates)   ·   Free · no login needed
QUICK  12 popular ingredient chips → tap goes to /kitchen with it selected
HOW    ① Add what you have → ② See what you can cook → ③ Get missing items as a list
FEAT   alternating text/screenshot: Pantry · Hindi names work · Shopping list · Meal plan
SAMPLE 4–8 recipe cards from the dataset
CTA    [Start cooking]
FOOTER About · GitHub · Privacy
```
- Submitting the hero input pre-fills the pantry and goes to `/kitchen`.
- Logged-in users and returning guests with a pantry go straight to `/kitchen`.
- Android builds skip the landing page.

### 4.8 Other screens
- **Saved:** grid of saved recipe cards.
- **Shopping list:** checkboxes, "Move checked to pantry", copy as text.
- **Meal plan:** mobile = list grouped by day; wide = week grid (rows Breakfast/Lunch/Dinner, columns Mon–Sun). Each slot: swap, remove, `+ Add`. Optional "✨ Plan my week" later.
- **Profile:** diet (veg/egg/nonveg), foods to avoid (chip input), household size, logout.

---

## 5. Design tokens (`src/theme.ts`)
| Token | Light | Use |
|---|---|---|
| `brand` | `#E8590C` (tomato orange) | headers, primary buttons |
| `brandDark` | `#B5440A` | pressed state |
| `accent` | `#2F9E44` (herb green) | selected chips, "have", 100% bar |
| `warn` | `#F59F00` | "missing 1", ≥50% bar |
| `ai` | `#7048E8` | AI button/badge only |
| `bg` | `#FFF9F3` | screen background |
| `surface` | `#FFFFFF` | cards, panels |
| `chip` | `#F1F3F5` | unselected chip |
| `text` / `muted` | `#212529` / `#5C636A` | body / meta (AA contrast) |
- Provide dark equivalents (`useColorScheme`, already used).
- Radii: panels 20, cards/inputs 12, chips/pills 999. Spacing on an 8px grid; 16px mobile gutters.
- Font: **Nunito** via `@expo-google-fonts/nunito` (free). Results headline ~32px light; hero 32–48px bold.
- Motion: 150ms chip toggle, count tick-up; respect reduce-motion.

## 6. Accessibility
- Chips and pills: `accessibilityRole="button"`, `accessibilityState={{ selected }}`, labels like "onion, selected".
- Color is never the only signal (✓/× on chips, icon + text on match lines).
- Live count announced (`accessibilityLiveRegion="polite"` on Android, `aria-live` on web).
- Works at 375px wide with no horizontal scroll; keyboard-usable on web.

---

## 7. PR plan (one PR each; follow the workflow in §0)
1. **Refactor:** add `theme.ts`, split `App.tsx` into `src/`, add `expo-router`. No visible change. CI green.
2. **Ingredient catalog:** `ingredients.json` + `GET /ingredients` + data test; category-card pantry UI.
3. **Matcher upgrade:** recipe fields in `recipes.json`, `/match` filters + sort + `{count, results, suggest}`, `GET /recipes/{id}`, tests. Update the app to read the new response shape.
4. **Results UI:** live headline, "Do you have?" chips, filter pills/sheet, new recipe card.
5. **Guest mode:** local pantry, anonymous match, `POST /pantry/bulk`, merge on login.
6. **Responsive shell:** two panels / drawer / bottom tabs.
7. **Recipe detail + cooking mode.**
8. **Landing page** (web only).
9. **Saved + shopping list.**
10. **Token expiry.**
11. **Meal plan + profile** (diet/avoid applied in `/match`).
12. **AI generate** (optional; free-tier LLM, rate-limited).

### Acceptance checks (after PR 6)
- [ ] A guest can add "aloo, pyaaz" by paste and sees results without logging in.
- [ ] Toggling a chip updates "You can make N" within ~300ms after the server is warm.
- [ ] Cards show the correct "You have all N" / "Missing 1: x" line.
- [ ] Filters combine correctly (e.g. Veg + ≤30 min + Missing 1).
- [ ] Layout works at 375px, 800px and 1280px; no horizontal scroll.
- [ ] `.\mvnw.cmd test` and `npx.cmd tsc --noEmit` pass; CI green.

---

## 8. Housekeeping (separate from the plan)
- Confirm the EAS APK build finished; install and test.
- Rotate the Neon password (Neon → Roles → Reset), then update `SPRING_DATASOURCE_URL` in Render.
- Optional: UptimeRobot ping to reduce Render cold starts; GitHub Actions APK build.
