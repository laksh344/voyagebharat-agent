# VoyageBHARAT — an AI travel agent for India

> Tell it a trip in plain English. An agent researches flights, trains, buses, hotels and weather **in parallel**, adds up the real cost, and hands you off to book. Built for the **Vercel AI Gateway Hackathon**.

**Try:** *"Plan a 4-day Goa trip from Hyderabad under ₹20,000 for 2"*

## What makes it an agent (not a chatbot)
The model isn't answering from memory. It runs a **reason → act → observe loop** (up to 12 steps) over seven tools:

| Tool | Does |
|---|---|
| `searchFlights` `searchHotels` | Live Google Flights / Hotels prices, tag cheapest / fastest / top rated, return booking links |
| `searchTrains` `searchBuses` | Estimated fares by class, with a live seat-check link |
| `getWeather` | Live forecast (Open-Meteo) inside 16 days, labelled seasonal estimate beyond |
| `getCabHandoff` | First/last-mile Uber / Ola / Rapido links + indicative fare range |
| `estimateBudget` | **Deterministic** cost maths — LLMs are unreliable at arithmetic, so all totals go through code |

It calls independent tools **in parallel**, recovers from dead ends (Manali has no airport → it reasons to the nearest hub instead of inventing flights), and states whether the plan fits your budget.

## How it uses Vercel AI Gateway
`lib/agent.ts` — the whole integration is a model string:

```ts
streamText({
  model: 'openai/gpt-oss-120b',           // any "provider/model" — no provider SDK, no per-provider key
  tools, stopWhen: stepCountIs(12),
  providerOptions: { gateway: {
    models: ['spacexai/grok-4.1-fast-non-reasoning', 'openai/gpt-4o-mini'],   // automatic cross-provider failover
    tags: ['voyagebharat', 'travel-agent'],                      // spend & latency reporting per feature
  } },
})
```
Change the model without touching code: `AGENT_MODEL` / `AGENT_FALLBACKS` env vars.

## Honest about its data
| | Status |
|---|---|
| Agent loop, tool calling, streaming UI, AI Gateway routing + fallbacks | **Real** |
| Weather (within 16 days) | **Live** — Open-Meteo |
| Booking links | **Real** redirect links, each stamped with a unique attribution sub-ID |
| Flight fares | **Live** — Google Flights via SerpApi (when `SERPAPI_KEY` is set) |
| Hotel rates | **Live** — Google Hotels via SerpApi (when `SERPAPI_KEY` is set) |
| Train and bus fares / seats | **Estimated** — India has no free, legitimate live API for these. Each card says so and links to the live seat search (ixigo / redBus). |

Every card footer names its source: *Live · Google Flights*, *Live · Google Hotels* or *Modelled estimate*. If SerpApi is down or out of quota, the tool falls back to the estimate and says why on the card, so the agent never stalls and never passes an estimate off as live. Results are cached for 30 minutes to stretch the free quota (250 searches/month). Nothing is ever booked in the chat, and it never asks for card, phone or OTP.

## Run it
```bash
npm install
cp .env.example .env.local     # add AI_GATEWAY_API_KEY; optionally SERPAPI_KEY for live flight/hotel prices
npm run dev                    # http://localhost:3000
```
**No key needed to verify the logic:**
```bash
npm run smoke          # every tool, the live-price path against a fake SerpApi (cache, quota, outage, key-leak checks), and the full agent loop
# then open /preview   # every result card rendered from real tool output (dev only — it's hidden in production to protect the SerpApi quota)
```

## Deploy (2 minutes)
1. Push this repo to GitHub (public).
2. Import it at vercel.com/new → add env vars `AI_GATEWAY_API_KEY` and (optional) `SERPAPI_KEY` → Deploy.
3. In the AI Gateway dashboard, **set a spend limit** on the key before sharing the URL. In SerpApi, turn on the usage alert.
4. Optional but recommended for a public link: add a Vercel WAF rate-limit rule on `/api/chat`. The built-in limiter (8 requests/min per IP) is per server instance, so it's only a first line of defence.

## Structure
```
lib/agent.ts     the agent loop + AI Gateway config      lib/tools.ts    7 tools (zod schemas)
lib/prompt.ts    system prompt                           lib/sample.ts   seeded fare/demand model
lib/geo.ts       44 India cities, hubs, distance model   lib/links.ts    affiliate-stamped redirects
lib/live.ts      SerpApi flights + hotels, 30-min cache
app/api/chat     streaming route + input validation + rate limit
components/      Chat + result cards; components/chat/ UI  scripts/        smoke tests (no API key) + model helpers
```

## License
MIT
