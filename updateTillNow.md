# Bai: project handoff (read this instead of re-exploring)
Snapshot: 2026-10-06, master `cb237a0`, PRs #1-#8 merged. Repo: github.com/ItsArpitPathak/Bai (local root `...\javaProject\bai`).

## What / why
Bai ("house help"): user lists kitchen items -> app ranks daily Indian home recipes by % ingredients on hand + shows missing items + steps. Hobby project for resume. Web + Android from one codebase. **Everything must be free tier.** Cuisine: simple daily Indian.

## User prefs
Terse replies, minimal code ("ponytail"/"caveman"), diffs over rewrites. Windows 11 + **PowerShell 5.1**: no `&&`; use `npx.cmd`, `.\mvnw.cmd`, `;`. Uses GitHub Desktop + `gh` (logged in as ItsArpitPathak). Workflow: branch -> push -> `gh pr create` -> user says "merge it" -> check CI green -> `gh pr merge N --squash --delete-branch`. Add `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` to commits.

## Stack
- Backend `backend/`: Spring Boot **4.1.1** (Jackson 3: import `tools.jackson.*`), Java 21 target (JDK 26 local), Maven wrapper only (no global mvn), JPA, spring-security-crypto (BCrypt only, no Spring Security).
- App `app/`: Expo SDK ~57, React Native + react-native-web, TypeScript, AsyncStorage, react-native-safe-area-context. No router; single file `app/App.tsx`.
- DB: local = H2 file `backend/data/` (gitignored); prod = Neon Postgres via env vars.

## Layout
- `backend/src/main/java/com/bai/backend/`: `Matcher.java` (pure logic), `ApiController.java` (all endpoints), `AppUser`, `AuthToken`, `PantryItem` (entities, public fields), `Repos.java` (UserRepo, TokenRepo, PantryRepo), `BackendApplication.java`.
- `backend/src/main/resources/data/`: `recipes.json` (169 recipes: name, veg, ingredients[], steps[]), `synonyms.json` (~100 Hindi->English, e.g. aloo=potato, pyaaz=onion, besan=gram flour). `application.properties` (H2 file default, `ddl-auto=update`, open-in-view off). Test props override to in-mem H2.
- Tests: `MatcherTest` (ranking, synonyms, missing), `BackendApplicationTests` (context loads). Run `cd backend; .\mvnw.cmd test`.
- `backend/Dockerfile` (2-stage JDK21, reads `$PORT`, `-Xmx300m`). `backend/mvnw` is mode 100755 (needed on Linux CI).
- `.github/workflows/ci.yml`: jobs backend (`./mvnw -B test`, JDK21) + app (`npm ci`, `npx tsc --noEmit`, Node 22) on push to master + PRs.
- `docs/bai-sequence.html`: Archify sequence diagram (standalone HTML, ~750KB; GitHub shows it as source). `README.md`, `arch_state.md` (compact state), `skills-lock.json` (Neon skills lock). `.gitignore` ignores node_modules, target, backend/data, graphify-out, .archify, .claude, .expo, dist.
- `app/eas.json`: `preview` profile -> APK, env `EXPO_PUBLIC_API_URL=https://bai-api.onrender.com`. `app/app.json`: name Bai, slug bai, `android.package=com.bai.app`, `userInterfaceStyle=automatic`, `owner=chars1`, EAS projectId `063958b2-0554-4285-ba7e-e70291736309`.

## API (CORS open via @CrossOrigin)
- `POST /auth/register|login` `{email,password}` -> `{token}`. Register needs `@` in email + password >=6; 400/409(dup)/401(wrong). Email lowercased.
- Auth = opaque UUID token in `AuthToken` table, header `Authorization: Bearer <t>`. **Tokens never expire** (known ponytail shortcut).
- `GET /pantry`, `POST /pantry {name}` (lowercased, dedupe by unique userId+name), `DELETE /pantry/{id}` (owner only). Each returns/is a list of `{id,name,userId}`.
- `GET /match` (uses user's pantry) or anonymous `GET /match?items=aloo,pyaaz`. Returns `[{recipe{name,veg,ingredients,steps},matchPct,missing[]}]` sorted desc over all 169.
- Matcher: normalize via synonyms -> set overlap; staples `salt, oil, ghee, water, sugar` ignored; pct = matched/needed non-staples (100 if none). Pantry stores names only (no qty/expiry yet).

## App behavior (`App.tsx`)
Login/register toggle -> pantry card (add input, removable chips, quick-add chips from `QUICK` list) -> filters All/Veg/Ready now -> recipe cards (match bar green 100 / amber >=50 / grey, tap for steps). Light+dark via `useColorScheme`. Token in AsyncStorage, survives reload. `API` = `EXPO_PUBLIC_API_URL` (trimmed, trailing slashes stripped) else `localhost:8080` (web) / `10.0.2.2:8080` (Android emu). Network failure (`TypeError`) shows "Server is waking up (free hosting)..." and does not log out.

## Deployed (all free)
- API: Render web service `bai-api` -> https://bai-api.onrender.com (Docker, root dir `backend`, free tier sleeps ~50s+ cold start). Env var `SPRING_DATASOURCE_URL` = `jdbc:postgresql://<neon-pooler-host>/neondb?user=...&password=...&sslmode=require` (**no `channelBinding`**). Creds only in Render, never in repo.
- DB: Neon Postgres project (branch production, db neondb). Tables auto-created.
- Web: Vercel project `bai-app` -> https://bai-app.vercel.app (root dir `app`, build `npx expo export -p web`, output `dist`, env `EXPO_PUBLIC_API_URL`). Auto-redeploys from master.
- Android: EAS build started (account `chars1`), build page https://expo.dev/accounts/chars1/projects/bai/builds/5ac9941e-cbd4-4d84-ab8d-ae6604fe510e . **Status unknown at handoff (was "in queue")**. Fallbacks offered: add-to-home-screen PWA from Vercel site; GitHub Actions workflow to build APK (not written yet).

## Gotchas learned (don't repeat)
- Windows: `&&` fails in PS 5.1; `npx.ps1` blocked -> `npx.cmd`.
- `create-expo-app` makes `app/.git`; it caused `app` to be committed as an empty submodule gitlink. Fixed (PR #2). Never recreate nested .git.
- Vercel env var had trailing `/` -> `//auth/register` -> server returned no CORS header -> looked like CORS error. Fixed in code (PR #4).
- Render free sleeps -> first request "Failed to fetch"; keep message friendly; optional UptimeRobot ping.
- Port 8080 conflicts when old backend still running; H2 file lock if two instances.
- Spring Boot 4 test slice/MockMvc packages moved; tests avoid them.
- Node web `Enter` key synthetic events don't always fire in browser-tool testing; real Enter works.

## Security note
Neon DB password was pasted in chat several times and **not rotated** (user declined). Recommend Neon -> Roles -> Reset password, then update Render `SPRING_DATASOURCE_URL`.

## Tooling/skills present
`gh` authed; Expo/EAS logged in as chars1; Neon skills in `.claude/skills`; Archify skill installed globally (diagrams in `.archify/`, ignored); graphify output in `graphify-out/` (ignored); PR auto-fix monitor was enabled in the desktop app session.

## Roadmap / next
1. Confirm APK build finished + install. 2. Pantry quantities + expiry ("use soon" ranking). 3. Shopping list of missing items. 4. Token expiry. 5. Barcode scan. 6. Host `docs/bai-sequence.html` on the Vercel site. 7. Rotate Neon password. 8. Optional: UptimeRobot ping, GitHub Actions APK build, more recipes/synonyms.
