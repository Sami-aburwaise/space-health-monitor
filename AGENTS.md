# Space Health Monitor — Agent Guide

Local-first AI health monitoring assistant (Vite + React + TypeScript).
No cloud backend. Chat, vitals, symptoms, and settings persist in `localStorage` only.

## Stack (do not invent alternatives)

| Layer | Choice |
| --- | --- |
| App | Vite, React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI | **shadcn/ui** (Nova / Radix) in `src/components/ui/` |
| Icons | **Lucide** (`lucide-react`) |
| Utils | `cn` / `@/lib/utils`, `clsx`, `tailwind-merge` |
| IDs | `uuid` |

Always prefer existing shadcn primitives (`Button`, `Card`, `Input`, `Textarea`, `ScrollArea`, `Badge`, `Label`, `Separator`, …). Add new ones with:

```bash
npx shadcn@latest add <component>
```

Do **not** introduce a second UI kit (MUI, Chakra, Ant, custom CSS-component libraries, etc.).

## Git workflow

1. **Never commit feature work directly on `main`.**
2. For every new feature, fix, or refactor: create and switch to a branch first.
   - Features: `feature/<short-name>`
   - Fixes: `fix/<short-name>`
   - Chores: `chore/<short-name>`
3. Keep commits focused; open a PR when asked.
4. Do not force-push `main` / `master`.
5. Do not commit secrets (API keys, `.env`).

## Product rules

- **Vitals are chat-ingested only** — no manual vitals forms.
- Extracted metrics go to `localStorage` (`shm:` prefix) as timestamped objects.
- Vitals History is a **read-only** dashboard.
- Empty states must stay clean (no fake/seeded health data).
- Clinical charcoal UI: `#0A0A0B` / `#111113` / `#222226`, emerald accents, mono tabular figures for metrics.
- Keep components modular: `src/components/`, hooks in `src/hooks/`, libs in `src/lib/`.

## Commands

```bash
npm run dev
npm run build
npm run lint
```
