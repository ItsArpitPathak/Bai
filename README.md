# Bai (House Help)

Tell Bai what's in your kitchen; it ranks daily Indian home recipes by how much you can already cook. Works on Web and Android from one codebase.

## Stack
- **Backend:** Spring Boot 4 (Java 21), REST, JPA. Register/login (BCrypt, opaque bearer tokens), per-user pantry, 169 seeded recipes, Hindi/English ingredient synonyms.
- **Database:** file H2 locally (`backend/data/`), Postgres in deploy via `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` (free Neon/Supabase tier).
- **App:** Expo (React Native + react-native-web), TypeScript.
- **Matching:** names normalized via `synonyms.json`; staples (salt, oil, ghee, water, sugar) assumed; score = % of non-staple ingredients on hand, missing items listed.
- All free: no paid APIs or services.

## Run locally (PowerShell)
```powershell
cd bai\backend; .\mvnw.cmd spring-boot:run     # API on :8080
cd bai\app; npx.cmd expo start --web           # web; press 'a' for Android emulator
```
Open the web URL Expo prints, create an account, add pantry items, tap a recipe for steps.

API: `POST /auth/register|login` -> `{token}`; with `Authorization: Bearer <token>`: `GET/POST /pantry`, `DELETE /pantry/{id}`, `GET /match`. Anonymous: `GET /match?items=aloo,pyaaz`.

## Test
```powershell
cd bai\backend; .\mvnw.cmd test
```

## Deploy (free tiers)
- **API:** Render web service, Docker runtime, root dir `bai/backend` (uses `Dockerfile`).
- **Web:** `cd bai\app; $env:EXPO_PUBLIC_API_URL="https://<your-api>.onrender.com"; npx.cmd expo export -p web` then upload `dist` to Vercel/Netlify.
- **Android APK:** `npx.cmd eas build -p android --profile preview` (free EAS tier).

## Roadmap
Expiry alerts, quantities, shopping list, token expiry, barcode scan.
