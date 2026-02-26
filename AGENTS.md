# Agents

## Cursor Cloud specific instructions

### Project overview

Touchline (timeline-app) is a React Native / Expo SDK 54 mobile app for sports match officiating. It uses Supabase for auth, database, and realtime features.

### Running the app

- **Dev server (web):** `EXPO_PUBLIC_SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" npx expo start --web --port 8081`
- The app runs on web via `react-native-web`. Navigate to `http://localhost:8081` in Chrome.
- Without Supabase credentials the app still renders (login page at `/login`) but auth calls will fail.
- `expo-secure-store` throws a non-fatal error on web (`ExpoSecureStore.default.getValue...`); this is expected and can be dismissed.

### Environment variables

Two secrets are required for full functionality:
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public API key

### Lint / Test / Build

- No ESLint, Prettier, TypeScript, or test framework is configured in this project.
- `npm run web` is equivalent to `npx expo start --web`.

### Gotchas

- `react-native-web` is required but was not originally listed in `package.json`; it gets installed during `npm install` after the update script adds it via `npx expo install react-native-web`.
- The splash screen (`/`) auto-redirects to `/login` or `/home` based on auth session. With placeholder/missing Supabase creds, it may stay on the splash screen; navigate directly to `/login` to see the full UI.
