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
- With "เตือนก่อนฝนตก" on, a device gets an hours-ahead warning (rain starting in 1-3 hours, once per rain spell) and a second alert about 30 minutes before rain.
- Alert and morning texts are fixed templates; only the chat tab calls Gemini.
- Chat tries `GEMINI_MODEL`, then each model in `GEMINI_FALLBACK_MODELS` (comma-separated, default ends with `gemini-3.5-flash-lite`). It moves on for 404/429/500/503/504 only; 400/401/403 fail at once because another model would fail the same way.
- Do not send `temperature`, `top_p` or `top_k`: Gemini 3.x deprecates them and newer models return 400.
- Voice call ("โทรคุยกับน้องฝน") uses Gemini Live. `/api/live-token` issues a single-use token locked to the model, voice and instructions (with the forecast); the phone then connects to Gemini directly, since Vercel functions cannot hold a WebSocket. Optional env: `GEMINI_LIVE_MODEL` (default `gemini-3.8-live`), `GEMINI_LIVE_VOICE` (defaults to `GEMINI_TTS_VOICE`, then `Leda`). Calls last at most 10 minutes.
- Read-aloud voice and style: `GEMINI_TTS_VOICE` (default `Leda`) and `GEMINI_TTS_STYLE`.
- GitHub scheduled runs can be delayed by several minutes, so "20 minutes before rain" is approximate.
