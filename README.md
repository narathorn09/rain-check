# เช็คฝน

Thai-language rain PWA for older users: an hourly dry/rain timeline, a radar map, push alerts, and a Gemini assistant ("น้องฝน").

Stack: Next.js (App Router) on Vercel, Open-Meteo (forecast), RainViewer (radar), Upstash Redis (devices), Web Push, Gemini.

## Local run

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
npm test
```

Generate VAPID keys with `npx web-push generate-vapid-keys`.

## Deploy checklist

1. Push this folder to a GitHub repo and import it in Vercel.
2. In Vercel, add the Upstash Redis integration (Marketplace). It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Set these environment variables in Vercel: `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
4. In the GitHub repo secrets add `APP_URL` (the production URL, no trailing slash) and the same `CRON_SECRET`. `.github/workflows/tick.yml` then calls `/api/cron/tick` every ~10 minutes.
5. Set a monthly spend cap for the Gemini key in Google AI Studio (the chat has no per-user limit).
6. On the phone, open the URL in Chrome and follow the 3-step setup.

## Notes

- Push alerts use the single saved place, not live GPS, and only cover 05:00-21:00 (`DAY_HOURS` in `lib/rain.ts`).
- Alert and morning texts are fixed templates; only the chat tab calls Gemini.
- Chat tries `GEMINI_MODEL`, then each model in `GEMINI_FALLBACK_MODELS` (comma-separated), moving on only when a model answers 503.
- GitHub scheduled runs can be delayed by several minutes, so "20 minutes before rain" is approximate.
