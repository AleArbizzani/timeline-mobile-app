# Preliminary Report Setup

The preliminary report feature uses the Claude API via a Supabase Edge Function. The API key must be stored as a Supabase secret and must never be committed to the repo or bundled in the app.

## Configure the API key

1. Copy your Anthropic API key from [claude-api-details](Documentation/claude-api-details) (or from the Anthropic Console).
2. Set it as a Supabase secret:

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=your-api-key-here
   ```

3. For local development, use the same command after starting Supabase locally.

## Deploy the Edge Function

Supabase's gateway has an ES256 JWT verification bug. We work around it by:
1. Deploying with `--no-verify-jwt` so the gateway lets requests through
2. Verifying the JWT **inside the function** using the project's JWKS (secure)

The app passes `Authorization: Bearer <session.access_token>` and the function verifies it before processing.

```bash
supabase functions deploy generate-preliminary-report --no-verify-jwt
```

## Test locally

```bash
supabase functions serve generate-preliminary-report
```

The function runs at `http://localhost:54321/functions/v1/generate-preliminary-report` when Supabase is running locally.

## Troubleshooting 401

If you see 401 "invalid_jwt" or "missing_authorization":

1. **Sign in** – The app must pass a valid session token. Sign out and back in if the session may be stale.
2. **Redeploy** – Ensure the function is deployed with `--no-verify-jwt` (gateway) and includes the internal JWT verification that uses your project's JWKS.
