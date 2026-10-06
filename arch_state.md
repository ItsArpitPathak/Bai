# Bai state
- Stack: SpringBoot(Java)+Postgres | Expo(TS, web+android)
- DB: AppUser(id,email,passwordHash) AuthToken(token,userId) PantryItem(id,userId,name; unique userId+name); recipes in JSON
- API: POST /auth/register|login | GET/POST /pantry, DELETE /pantry/{id} (Bearer) | GET /match (pantry or ?items=)
- Matcher: normalize(name via synonyms.json) -> set overlap; staples (salt,oil,haldi,jeera...) assumed present
- App: single App.tsx: auth form -> pantry chips + ranked recipes (tap for steps); token in AsyncStorage
- Status: DONE: matcher, 169 recipes, auth (opaque token), pantry CRUD, Expo login+pantry+match UI, Dockerfile, README. TODO: deploy (user accounts), expiry, qty, shopping list
