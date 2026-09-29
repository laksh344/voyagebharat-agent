# VoyageBHARAT — an AI travel agent for India

> Tell it a trip in plain English. An agent researches flights, trains, buses, hotels and weather **in parallel**, adds up the real cost, and hands you off to book. Built for the **Vercel AI Gateway Hackathon**.

**Try:** *"Plan a 4-day Goa trip from Hyderabad under ₹20,000 for 2"*

## What makes it an agent (not a chatbot)
The model isn't answering from memory. It runs a **reason → act → observe loop** (up to 10 steps) over seven tools:

| Tool | Does |
|---|---|
| `searchFlights` `searchTrains` `searchBuses` `searchHotels` | Compare options, tag cheapest / fastest, return booking links |
| `getWeather` | Live forecast (Open-Meteo) inside 16 days, labelled seasonal estimate beyond |
| `getCabHandoff` | First/last-mile Uber / Ola / Rapido links + indicative fare range |
| `estimateBudget` | **Deterministic** cost maths — LLMs are unreliable at arithmetic, so all totals go through code |

It calls independent tools **in parallel**, recovers from dead ends (Manali has no airport → it reasons to the nearest hub instead of inventing flights), and states whether the plan fits your budget.

## How it uses Vercel AI Gateway
`lib/agent.ts` — the whole integration is a model string:

```ts
streamText({
  model: 'google/gemini-3.6-flash',             // any "provider/model" — no provider SDK, no per-provider key
  tools, stopWhen: stepCountIs(10),
  providerOptions: { gateway: {
    models: ['deepseek/deepseek-v4-flash', 'openai/gpt-5-nano'], // automatic cross-provider failover
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
| Fares, seat availability, hotel prices | **Modelled** (distance + demand model, seeded per route/date) and labelled *"Modelled estimate"* in the UI. Not live inventory. |

The tool layer is the only thing to swap for live data (Amadeus, redBus, IRCTC partner, Booking…) — the agent, prompt and UI don't change. Nothing is ever booked in the chat, and it never asks for card, phone or OTP.

## Run it
```bash
npm install
cp .env.example .env.local     # add AI_GATEWAY_API_KEY (Vercel dashboard → AI Gateway → API keys)
npm run dev                    # http://localhost:3000
```
**No key needed to verify the logic:**
```bash
npm run smoke          # 30 checks: every tool + failure paths + the full multi-step agent loop (scripted model)
# then open /preview   # every result card rendered from real tool output
```

## Deploy (2 minutes)
1. Push this repo to GitHub (public).
2. Import it at vercel.com/new → add env var `AI_GATEWAY_API_KEY` → Deploy.
3. In the AI Gateway dashboard, **set a spend limit** on the key before sharing the URL.

## Structure
```
lib/agent.ts     the agent loop + AI Gateway config      lib/tools.ts    7 tools (zod schemas)
lib/prompt.ts    system prompt                           lib/sample.ts   seeded fare/demand model
lib/geo.ts       30 India cities, hubs, distance model   lib/links.ts    affiliate-stamped redirects
app/api/chat     streaming route + input guards + rate limit
components/      Chat (useChat) + result cards           scripts/        smoke tests (no API key)
```

## License
MIT
