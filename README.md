# X-Ray Candidate Sourcer

Frontend-only React (Vite) MVP for recruiting: AI-crafted X-Ray Google searches (SerpApi), OpenAI parsing and scoring, and Apollo.io contact enrichment. **All API calls run from the browser** — configure keys in `.env` (see `.env.example`).

## Required environment variables

| Variable | Service | Where to get it | Free tier / notes |
|----------|---------|-----------------|---------------------|
| `VITE_OPENAI_API_KEY` | OpenAI (Chat Completions) | [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Usage-based billing; keys start with `sk-proj-` or `sk-`. |
| `VITE_OPENAI_MODEL` | _(optional)_ | — | Defaults to **`gpt-4o`**. You can set e.g. `gpt-4o-mini` to reduce cost. |
| `VITE_SERP_API_KEY` | SerpApi (Google results) | [https://serpapi.com/](https://serpapi.com/) | **100 searches/month** on the free tier (each paginated request counts as a search). Requests go through **`/serpapi` → Vite proxy** (`vite.config.js`). Each platform query fetches **up to 5 Google result pages** (`num=10`, `start=0,10,…`) then merges/dedupes links — set **`VITE_SERP_MAX_PAGES`** (1–10, default 5) to tune cost vs coverage. |
| `VITE_APOLLO_API_KEY` | Apollo.io (email/phone match) | [https://www.apollo.io/](https://www.apollo.io/) | Free tier available; credits/limits vary by plan. Calls use **`/apolloio` → Vite proxy** to `api.apollo.io` (same-origin, avoids browser CORS). Use `npm run dev` or `npm run preview`. |
| `VITE_APOLLO_WEBHOOK_URL` | _(optional)_ Apollo phone reveal | — | Apollo requires a **public `webhook_url`** when `reveal_phone_number` is true (they POST the number when ready). If unset, the app **does not** request phone reveal so `people/match` still succeeds; you may still get **email** and any phone Apollo returns without async reveal. For numbers, set this to an **HTTPS** endpoint you control (e.g. **ngrok** tunnel to a small server). |

Copy `.env.example` to `.env` and fill in your keys. Restart `npm run dev` after changing `.env`.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Security note

Putting API keys in a Vite app exposes them to anyone who can open the built JS. This MVP is for demos and internal tools only. For production, proxy APIs through your own backend. **Never commit real keys** and **revoke any key** that was pasted into chat, tickets, or screenshots.

## Stack

- React 19 + Vite 8  
- Tailwind CSS v4 (`@tailwindcss/vite`)  
- Single-page wizard (no router)
