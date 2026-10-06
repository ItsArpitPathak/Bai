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

## Deploy (all free tiers)
1. **Database:** create a free Neon (neon.tech) Postgres project. Note host, db, user, password.
2. **API (Render):** New Web Service from the GitHub repo, Runtime Docker, Root Directory `backend`, Instance Free. Env vars:
   - `SPRING_DATASOURCE_URL=jdbc:postgresql://<host>/<db>?sslmode=require`
   - `SPRING_DATASOURCE_USERNAME=<user>`
   - `SPRING_DATASOURCE_PASSWORD=<password>`
   Free instances sleep when idle, so the first request after a pause takes ~30-60s.
3. **Web (Vercel):** Import the repo, Root Directory `app`, Build Command `npx expo export -p web`, Output Directory `dist`, env var `EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com`.
4. **Android APK:** `cd app; npx.cmd eas-cli login; npx.cmd eas-cli init; npx.cmd eas-cli build -p android --profile preview` (free EAS tier). The API URL is set in `app/eas.json`. Open the download link on your phone to install the APK.

## Roadmap
Expiry alerts, quantities, shopping list, token expiry, barcode scan.
