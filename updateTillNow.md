# Bai: project handoff (read this instead of re-exploring)
Snapshot: 2026-10-07, master `9472041`, PRs #1-#22 merged. Repo: github.com/ItsArpitPathak/Bai (local root `...\javaProject\bai`). Design brief: `inspiration.md` (all 12 PRs of its plan are done).

## What / why
Bai ("house help"): user lists kitchen items -> app ranks daily Indian home recipes by % ingredients on hand + shows missing items + steps. Hobby project for resume. Web + Android from one codebase. **Everything must be free tier.** Cuisine: simple daily Indian.

## User prefs
Terse replies, minimal code ("ponytail"/"caveman"), diffs over rewrites. Windows 11 + **PowerShell 5.1**: no `&&`; use `npx.cmd`, `.\mvnw.cmd`, `;`. Uses GitHub Desktop + `gh` (logged in as ItsArpitPathak). Workflow: branch -> push -> `gh pr create` -> check CI green -> `gh pr merge N --squash --delete-branch`. For the 11-PR plan the user gave standing approval to merge each PR once CI is green and start the next; otherwise wait for "merge it". Add `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` to commits.

## Stack
- Backend `backend/`: Spring Boot **4.1.1** (Jackson 3: import `tools.jackson.*`), Java 21 target (JDK 26 local), Maven wrapper only, JPA, spring-security-crypto (BCrypt only, no Spring Security).
- App `app/`: Expo SDK ~57, React Native + react-native-web, TypeScript, **expo-router** (routes in `src/app/`, per `app/AGENTS.md`), AsyncStorage, expo-keep-awake.
- DB: local = H2 file `backend/data/` (gitignored); prod = Neon Postgres via env vars. `ddl-auto=update` creates new tables/columns on deploy.

## Layout
- `backend/src/main/java/com/bai/backend/`: `Matcher.java` (pure logic: synonyms, filters, sort, suggest, canonical), `Gemini.java` (REST client, prompt, strict reply validation), `ApiController.java` (all endpoints), entities `AppUser` (+diet, avoid csv, householdSize), `AuthToken` (+expiresAt), `PantryItem`, `SavedRecipe`, `ShoppingItem`, `MealPlanEntry` (public fields), `Repos.java`, `BackendApplication.java`.
- `backend/src/main/resources/data/`: `recipes.json` (169 recipes: id, name, veg, diet, mealType[], timeMinutes, difficulty, tags[], ingredients[], steps[]; **metadata assigned by name heuristics, expect tweaks**), `ingredients.json` (8 category cards, every non-staple recipe ingredient in exactly one), `synonyms.json` (~100 Hindi->English).
- Tests (`cd backend; .\mvnw.cmd test`): `MatcherTest` (rank, sort, filters, suggest, canonical), `DataTest` (recipe fields + catalog coverage), `AuthTokenTest`, `GeminiTest`, `BackendApplicationTests`. Avoid Spring Boot 4 MockMvc/test-slice packages (moved).
- `app/src/`: `app/` routes (`_layout` providers, `index` landing/redirect, `kitchen`, `login`, `recipe/[id]`, `saved`, `list`, `plan`, `profile`), `components/` (Kitchen, CategoryCard, RecipeCard, RecipeDetail, Landing, Login, Screen, Saved, ShoppingList, Plan, Profile), `api.ts`, `auth.tsx`, `lists.tsx` (saved ids + add-to-list), `store.ts` (guest pantry), `styles.ts`, `theme.ts`. `app/vercel.json` rewrites to index.html (deep links).
- `backend/Dockerfile`, `.github/workflows/ci.yml` (backend `./mvnw -B test` + app `npm ci`, `npx tsc --noEmit`), `docs/bai-sequence.html`, `README.md`, `arch_state.md`, `inspiration.md`, `skills-lock.json`.
- `app/eas.json`: `preview` profile -> APK, env `EXPO_PUBLIC_API_URL=https://bai-api.onrender.com`. `app/app.json`: name Bai, slug bai, scheme bai, `android.package=com.bai.app`, `owner=chars1`, EAS projectId `063958b2-0554-4285-ba7e-e70291736309`.

## API (CORS open via @CrossOrigin; auth = `Authorization: Bearer <uuid>`)
- Auth: `POST /auth/register|login` `{email,password}` -> `{token}`. Tokens expire in 30 days (legacy tokens with null expiry are stamped on first use); expired -> 401 and the app logs out.
- Pantry: `GET /pantry`, `POST /pantry {name}`, `POST /pantry/bulk {names[]}`, `DELETE /pantry/{id}`. Names are synonym-canonicalized (aloo -> potato) and deduped. Public `GET /canonical?names=a,b` does the same for guests.
- `GET /ingredients` (catalog), `GET /recipes/{id}`.
- `GET /match` -> `{count, results[{recipe,matchPct,missingCount,missing}], suggest[]}`. Params: `items` (guest, csv), `diet` (veg | egg = veg+egg), `mealType`, `maxTime`, `maxMissing`, `include`, `exclude`. Logged-in (no `items`): uses their pantry and applies profile diet + avoid unless `diet` is passed. Sort: missingCount, matchPct desc, time. `count` = ready-now recipes after filters. Staples `salt, oil, ghee, water, sugar` ignored.
- `POST /generate {prompt?}` (login, 5/user/day, spent on attempt): sends pantry + diet + avoid + household size to Gemini (`generateContent`, model `GEMINI_MODEL`, default `gemini-3.5-flash-lite`), returns up to 3 validated recipes with `ai-` ids (not persisted, not saveable/plannable yet). 503 unless `GEMINI_API_KEY` is set on the server; 502 if Gemini fails; 429 over quota. Free-tier Gemini content may be used to improve Google products. **Never run against a real key yet: first live test pending.**
- Login required: `GET/POST /saved`, `DELETE /saved/{recipeId}` (GET returns match results vs pantry); `GET/POST /shopping`, `PATCH/DELETE /shopping/{id}`, `POST /shopping/to-pantry`; `GET/PUT /profile {diet,avoid[],householdSize}`; `GET/POST/DELETE /plan` (one recipe per date+slot, POST swaps).

## App behavior
- Opens at `/`: web + logged out + empty guest pantry -> landing page (hero input pre-fills guest pantry); everyone else -> `/kitchen`. Android skips the landing page. No login wall; guest pantry in AsyncStorage, merged into the account via `/pantry/bulk` on login.
- Kitchen: pantry input accepts pasted comma/newline lists, category cards with toggle chips and "+N more", live "You can make N recipes" headline, "Do you have?" suggestions, server-side filter pills (Veg, Ready now, Missing 1, <=30 min, meal type; debounced 250ms), recipe cards (tile, meta row, match line, "+ list", heart, match bar green 100 / amber >=50 / grey).
- Layout: >=1024px two panels (2 cols, 3 at >=1440); 768-1023 results + pantry drawer; <768 bottom tabs Pantry/Recipes. Top bar icons: saved, list, plan, profile (guests see "Log in").
- Recipe detail: ingredients marked have/missing, steps, Save, Share, Add missing to list, Add to plan, cooking mode (one step at a time, keeps screen awake).
- Light+dark via `useColorScheme`. `API` = `EXPO_PUBLIC_API_URL` (trimmed) else `localhost:8080` (web) / `10.0.2.2:8080` (Android emu). Network failure shows "Server is waking up (free hosting)..." and does not log out.

## Deployed (all free)
- API: Render web service `bai-api` -> https://bai-api.onrender.com (Docker, root dir `backend`, free tier sleeps ~50s+). Env vars: `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`) to enable AI generate; `SPRING_DATASOURCE_URL` = `jdbc:postgresql://<neon-pooler-host>/neondb?user=...&password=...&sslmode=require` (**no `channelBinding`**). Creds only in Render, never in repo. **Confirm Render redeployed master** (old API lacks the new response shape).
- DB: Neon Postgres (branch production, db neondb).
- Web: Vercel `bai-app` -> https://bai-app.vercel.app (root dir `app`, `npx expo export -p web`, output `dist`, env `EXPO_PUBLIC_API_URL`). Auto-deploys from master.
- Android: EAS build was queued earlier (account `chars1`, build 5ac9941e-cbd4-4d84-ab8d-ae6604fe510e). **Status unknown**; a rebuild is needed to get the new UI. Fallbacks: PWA from the Vercel site; GitHub Actions APK build (not written).

## Gotchas learned (don't repeat)
- Windows: `&&` fails in PS 5.1; `npx.ps1` blocked -> `npx.cmd`.
- `create-expo-app` makes `app/.git` (once committed as an empty submodule). Never recreate nested .git.
- Vercel env var with trailing `/` caused `//auth/register` -> looked like CORS. Code strips trailing slashes.
- Render free sleeps -> first request fails; message stays friendly.
- Port 8080 conflicts when an old backend still runs; H2 file lock if two instances.
- Guest pantry items share id -1: use the name as React key.
- Verification so far: `tsc`, backend tests, curl on endpoints and browser checks at 375/800/1280px. **Nothing tested on an Android device**, and the `inspiration.md` acceptance checklist has not been run end to end.

## Security note
Neon DB password was pasted in chat several times and **not rotated**. Recommend Neon -> Roles -> Reset password, then update Render `SPRING_DATASOURCE_URL`.

## Gaps vs inspiration.md / next
1. Confirm Render redeploy, then rebuild + install the APK. 2. Add `GEMINI_API_KEY` in Render (bai-api -> Environment), redeploy, and test the AI button with a real key; then consider saving/planning AI recipes. 3. Not built: Include/Exclude filter pills, bottom tabs for Plan/List/Me (currently top-bar icons), Nunito font, ingredient quantities/servings stepper, About/Privacy pages, landing screenshots. 4. Review the heuristic recipe metadata. 5. Rotate Neon password. 6. Optional: UptimeRobot ping, GitHub Actions APK build, host `docs/bai-sequence.html`, more recipes/synonyms.
