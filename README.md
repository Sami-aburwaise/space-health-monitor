# Space Health Monitor

A local-first health assistant for astronauts, built for the NASA Space Apps Challenge 2026 ("Create Health Monitoring Software for Astronauts").

A crew member with no medical training tells the coach their readings in chat. For each one the app shows whether it is **normal**, on **watch** or an **alert**, what to do next, and when to contact the flight surgeon.

> Prototype for NASA Space Apps. Thresholds are illustrative, not medical advice. Always follow your flight surgeon.

## What it does

- **Six core indicators:** heart rate, blood pressure, blood glucose, body temperature, sleep and mood. SpO₂ is tracked as an extra.
- **Status:** each reading gets a normal / watch / alert level. The overall status is the worst level among today's readings. An indicator on watch 3 days in a row becomes an alert. Two or more indicators on watch on the same day adds a note to mention them to the flight surgeon. Indicators with no reading today show as "Not measured".
- **Guidance per indicator:**
  - What the indicator is and how to measure it in space.
  - Which of NASA's five spaceflight hazards and Human Research Program risks it relates to.
  - What to do at each level, when to contact ground, and how to prevent problems.
- **Health Status page:** a body map, status cards, and trend charts with axes, units and the normal band (7, 14 or 30 days).
- **Input checks:** impossible values (for example a heart rate of 400 or a negative temperature) and readings without a number are refused with a reason and never stored.
- **Emergencies:** critical readings switch the coach to emergency mode with step-by-step instructions. Contacting the flight surgeon always comes first.
- **Mission environment:** Space station, Moon base, Mars habitat or Surface rover. This changes the comms delay and how alerts tell you to reach ground.
- **Daily check-in and workouts:** a one-tap check-in for all six indicators, plus a guided resistance routine that checks temperature and heart rate before each set. The workout is paused while any recent reading is in the alert range.
- **About & Sources:** the thresholds table, escalation rules, NASA hazards and risks, and every reference used.

## Privacy

There is no backend. Chat, readings and settings are stored only in this browser's `localStorage` (keys prefixed with `shm:`).

Readings are always evaluated on the device. If a Claude API key is set, chat messages that are not readings are answered by Anthropic's Claude, which receives the last few messages and the latest reading. If an ElevenLabs key is set, the coach's replies are sent to ElevenLabs to be spoken aloud.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # optional: add API keys
npm run dev
```

Optional keys in `.env.local`:

| Variable | Used for |
| --- | --- |
| `VITE_CLAUDE_API_KEY` | Free-form chat replies (the app works offline without it) |
| `VITE_ELEVENLABS_API_KEY` | Coach voice |
| `VITE_ELEVENLABS_VOICE_ID` | Voice override |
| `VITE_EXERCISE_API_KEY` | Exercise search |

Never commit `.env.local`.

Other commands:

```bash
npm run build
npm run lint
```

## Where things live

| Path | Contents |
| --- | --- |
| `src/lib/health/indicators.ts` | Indicator definitions, bands and guidance |
| `src/lib/health/status.ts` | Overall status, escalation and streak |
| `src/lib/health/sources.ts` | NASA hazards, HRP risks, references, disclaimer |
| `src/lib/health/environment.ts` | Mission environments and contact-ground wording |
| `src/lib/extractVitals.ts` | Reading parser, plausible ranges, critical thresholds |
| `src/lib/coach/` | Local coach replies, emergency procedures, Claude prompt |
| `src/components/vitals/` | Health Status page, body map, trend chart, indicator guide |
| `src/components/sources/` | About & Sources page |

## Built with

Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Lucide and Three.js. Optional services are the Anthropic Claude API and ElevenLabs. Exercise images come from free-exercise-db.
